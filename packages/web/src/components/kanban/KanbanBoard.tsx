import { useState, useMemo, useCallback, useRef } from 'react';
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { Workflow } from 'lucide-react';
import type { DashboardRunResponse } from '@/lib/api';
import type { WorkflowRunStatus } from '@/lib/types';
import { KanbanColumn } from './KanbanColumn';
import { TransitionDialog } from './TransitionDialog';

interface KanbanBoardProps {
  runs: DashboardRunResponse[];
  isLoading: boolean;
  onCancel: (runId: string) => Promise<void>;
  onResume: (runId: string) => Promise<void>;
  onAbandon: (runId: string) => Promise<void>;
  onDelete: (runId: string) => Promise<void>;
  onApprove: (runId: string, comment?: string) => Promise<void>;
  onReject: (runId: string, reason?: string) => Promise<void>;
}

interface Transition {
  action: 'resume' | 'approve' | 'reject' | 'cancel';
  needsInput: boolean;
  inputRequired: boolean;
}

const PERMITTED = new Map<string, Transition>([
  ['failed->pending', { action: 'resume', needsInput: false, inputRequired: false }],
  ['cancelled->pending', { action: 'resume', needsInput: false, inputRequired: false }],
  ['paused->running', { action: 'approve', needsInput: true, inputRequired: false }],
  ['paused->cancelled', { action: 'reject', needsInput: true, inputRequired: true }],
  ['running->cancelled', { action: 'cancel', needsInput: false, inputRequired: false }],
]);

const COLUMNS: { status: WorkflowRunStatus; label: string; colorClass: string }[] = [
  { status: 'pending', label: 'Pending', colorClass: 'text-text-secondary' },
  { status: 'running', label: 'Running', colorClass: 'text-primary' },
  { status: 'paused', label: 'Waiting for Approval', colorClass: 'text-warning' },
  { status: 'completed', label: 'Completed', colorClass: 'text-success' },
  { status: 'failed', label: 'Failed', colorClass: 'text-error' },
  { status: 'cancelled', label: 'Cancelled', colorClass: 'text-text-tertiary' },
];

interface PendingTransition {
  runId: string;
  transition: Transition;
}

const DIALOG_CONFIG: Record<
  'approve' | 'reject',
  { title: string; description: string; inputLabel: string; confirmLabel: string }
> = {
  approve: {
    title: 'Approve workflow',
    description: 'Optionally add a comment before approving this workflow.',
    inputLabel: 'Comment (optional)',
    confirmLabel: 'Approve',
  },
  reject: {
    title: 'Reject workflow',
    description: 'Provide a reason for rejecting this workflow.',
    inputLabel: 'Reason (required)',
    confirmLabel: 'Reject',
  },
};

export function KanbanBoard({
  runs,
  isLoading,
  onCancel,
  onResume,
  onAbandon,
  onDelete,
  onApprove,
  onReject,
}: KanbanBoardProps): React.ReactElement {
  const [invalidColumn, setInvalidColumn] = useState<string | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const invalidColumnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const groupedRuns = useMemo(() => {
    const groups = new Map<WorkflowRunStatus, DashboardRunResponse[]>();
    for (const col of COLUMNS) {
      groups.set(col.status, []);
    }
    for (const run of runs) {
      const arr = groups.get(run.status);
      if (arr) arr.push(run);
    }
    return groups;
  }, [runs]);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setInvalidColumn(null);
      const { active, over } = event;
      if (!over) return;

      const runId = active.id as string;
      const sourceStatus = (active.data.current as { status: string } | undefined)?.status;
      const targetStatus = over.id as string;

      if (sourceStatus === targetStatus) return;

      const key = `${sourceStatus}->${targetStatus}`;
      const transition = PERMITTED.get(key);

      if (!transition) {
        if (invalidColumnTimerRef.current !== null) {
          clearTimeout(invalidColumnTimerRef.current);
        }
        setInvalidColumn(targetStatus);
        invalidColumnTimerRef.current = setTimeout(() => {
          setInvalidColumn(null);
          invalidColumnTimerRef.current = null;
        }, 1000);
        return;
      }

      if (transition.needsInput) {
        setPendingTransition({ runId, transition });
        return;
      }

      switch (transition.action) {
        case 'resume':
          void onResume(runId);
          break;
        case 'cancel':
          void onCancel(runId);
          break;
      }
    },
    [onResume, onCancel]
  );

  const handleTransitionConfirm = useCallback(
    (text: string) => {
      if (!pendingTransition) return;
      const { runId, transition } = pendingTransition;
      switch (transition.action) {
        case 'approve':
          void onApprove(runId, text || undefined);
          break;
        case 'reject':
          void onReject(runId, text || undefined);
          break;
      }
      setPendingTransition(null);
    },
    [pendingTransition, onApprove, onReject]
  );

  const dialogAction: 'approve' | 'reject' =
    pendingTransition?.transition.action === 'reject' ? 'reject' : 'approve';
  const dialogConfig = DIALOG_CONFIG[dialogAction];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center flex-1">
        <span className="text-sm text-text-tertiary">Loading...</span>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 gap-3">
        <Workflow className="h-10 w-10 text-text-tertiary" />
        <p className="text-sm text-text-tertiary">No workflow runs found</p>
      </div>
    );
  }

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex flex-row gap-4 overflow-x-auto h-full p-4">
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.status}
              status={col.status}
              label={col.label}
              colorClass={col.colorClass}
              runs={groupedRuns.get(col.status) ?? []}
              isInvalidDrop={invalidColumn === col.status}
              onCancel={(id): void => {
                void onCancel(id);
              }}
              onResume={(id): void => {
                void onResume(id);
              }}
              onAbandon={(id): void => {
                void onAbandon(id);
              }}
              onDelete={(id): void => {
                void onDelete(id);
              }}
              onApprove={(id): void => {
                void onApprove(id);
              }}
            />
          ))}
        </div>
      </DndContext>

      <TransitionDialog
        open={pendingTransition !== null}
        title={dialogConfig.title}
        description={dialogConfig.description}
        inputLabel={dialogConfig.inputLabel}
        inputRequired={pendingTransition?.transition.inputRequired ?? false}
        confirmLabel={dialogConfig.confirmLabel}
        onConfirm={handleTransitionConfirm}
        onCancel={(): void => {
          setPendingTransition(null);
        }}
      />
    </>
  );
}
