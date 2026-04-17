import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listDashboardRuns,
  cancelWorkflowRun,
  resumeWorkflowRun,
  abandonWorkflowRun,
  deleteWorkflowRun,
  approveWorkflowRun,
  rejectWorkflowRun,
  type DashboardRunResponse,
} from '@/lib/api';
import { ensureUtc } from '@/lib/format';
import { useDashboardSSE } from '@/hooks/useDashboardSSE';
import { useWorkflowStore } from '@/stores/workflow-store';
import { KanbanBoard } from '@/components/kanban/KanbanBoard';

export function KanbanPage(): React.ReactElement {
  const queryClient = useQueryClient();
  useDashboardSSE();
  const hydrateWorkflow = useWorkflowStore(state => state.hydrateWorkflow);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['kanbanRuns'],
    queryFn: () => listDashboardRuns({ limit: 200 }),
    refetchInterval: 30_000,
  });

  const runs: DashboardRunResponse[] = data?.runs ?? [];

  // Hydrate Zustand store from REST-polled data for active runs
  useEffect(() => {
    for (const run of runs) {
      if (run.status === 'running' || run.status === 'pending' || run.status === 'paused') {
        hydrateWorkflow({
          runId: run.id,
          workflowName: run.workflow_name,
          status: run.status,
          dagNodes: [],
          artifacts: [],
          startedAt: new Date(ensureUtc(run.started_at)).getTime(),
          currentTool: null,
        });
      }
    }
  }, [runs, hydrateWorkflow]);

  async function runAction(
    action: (runId: string) => Promise<unknown>,
    runId: string,
    fallbackMessage: string
  ): Promise<void> {
    try {
      setActionError(null);
      await action(runId);
      void queryClient.invalidateQueries({ queryKey: ['kanbanRuns'] });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : fallbackMessage);
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {actionError && (
        <div className="rounded-md border border-error/30 bg-error/5 px-4 py-3 text-sm text-error mx-4 mt-4">
          {actionError}
        </div>
      )}
      <KanbanBoard
        runs={runs}
        isLoading={isLoading}
        onCancel={(id): Promise<void> => runAction(cancelWorkflowRun, id, 'Failed to cancel')}
        onResume={(id): Promise<void> => runAction(resumeWorkflowRun, id, 'Failed to resume')}
        onAbandon={(id): Promise<void> => runAction(abandonWorkflowRun, id, 'Failed to abandon')}
        onDelete={(id): Promise<void> => runAction(deleteWorkflowRun, id, 'Failed to delete')}
        onApprove={(id, comment): Promise<void> =>
          runAction(runId => approveWorkflowRun(runId, comment), id, 'Failed to approve')
        }
        onReject={(id, reason): Promise<void> =>
          runAction(runId => rejectWorkflowRun(runId, reason), id, 'Failed to reject')
        }
      />
    </div>
  );
}
