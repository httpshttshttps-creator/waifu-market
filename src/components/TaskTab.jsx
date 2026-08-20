import { useCallback, useEffect, useState } from "react";
import { fetchTasks, claimDailyBonus, claimTask } from "../api/tasksApi.js";
import TaskCard from "./TaskCard.jsx";
import TaskAdminForm from "./TaskAdminForm.jsx";

export default function TaskTab({ notify }) {
  const [data, setData] = useState(null);
  const [claimingTaskId, setClaimingTaskId] = useState(null);
  const [claimingDaily, setClaimingDaily] = useState(false);
  const [showAdminForm, setShowAdminForm] = useState(false);

  const load = useCallback(() => {
    fetchTasks().then(setData);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDailyClaim() {
    setClaimingDaily(true);
    try {
      await claimDailyBonus();
      notify?.("success");
      load();
    } catch {
      notify?.("error");
    } finally {
      setClaimingDaily(false);
    }
  }

  async function handleTaskClaim(taskId) {
    setClaimingTaskId(taskId);
    try {
      await claimTask(taskId);
      notify?.("success");
      load();
    } catch {
      notify?.("error");
    } finally {
      setClaimingTaskId(null);
    }
  }

  if (!data) {
    return <p className="empty-state">Loading tasks…</p>;
  }

  return (
    <div className="task-tab">
      <h1 className="brand-title">📋 TASKS</h1>

      <button
        type="button"
        className="daily-claim-button"
        disabled={data.daily_claimed || claimingDaily}
        onClick={handleDailyClaim}
      >
        {data.daily_claimed
          ? "✅ Daily bonus claimed - come back tomorrow"
          : claimingDaily
          ? "Claiming…"
          : `🎁 Claim daily ${data.daily_reward} VɎ`}
      </button>

      {data.is_admin ? (
        <button
          type="button"
          className="sheet-button sheet-button--confirm admin-add-task-button"
          onClick={() => setShowAdminForm(true)}
        >
          ➕ Add Task
        </button>
      ) : data.tasks.length === 0 ? (
        <p className="empty-state">No tasks available right now - check back soon.</p>
      ) : (
        <div className="task-list">
          {data.tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClaim={handleTaskClaim} claiming={claimingTaskId === task.id} />
          ))}
        </div>
      )}

      {showAdminForm && (
        <TaskAdminForm
          onClose={() => setShowAdminForm(false)}
          onCreated={() => {
            setShowAdminForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}
