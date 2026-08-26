import { useMemo, useState } from "react";
import {
  useListTasks,
  useUpdateTask,
  getListTasksQueryKey,
  getGetDashboardSummaryQueryKey,
  getGetNotificationsQueryKey,
} from "@workspace/api-client-react";
import type { ApiError, Task } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ChevronLeft, ChevronRight, AlertTriangle, Loader2, User } from "lucide-react";
import { taskStatusMap } from "@/lib/format";

type ViewMode = "month" | "week" | "day";

const VIEWS: { value: ViewMode; label: string }[] = [
  { value: "month", label: "Mês" },
  { value: "week", label: "Semana" },
  { value: "day", label: "Dia" },
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function taskRange(task: Task): { start: Date; end: Date } {
  const start = new Date(task.dueAt);
  const end = task.endAt ? new Date(task.endAt) : start;
  return { start, end };
}

/** Two tasks conflict if their [start,end] ranges overlap (touching endpoints don't count). */
function tasksOverlap(a: Task, b: Task): boolean {
  const ra = taskRange(a);
  const rb = taskRange(b);
  return ra.start < rb.end && rb.start < ra.end;
}

export function Agenda() {
  const [view, setView] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState<Date>(() => startOfDay(new Date()));
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: tasks, isLoading } = useListTasks();

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateTask();

  // Tasks grouped by day (sv key = local YYYY-MM-DD)
  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks ?? []) {
      const key = new Date(t.dueAt).toLocaleDateString("sv");
      (map[key] ??= []).push(t);
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
    }
    return map;
  }, [tasks]);

  // Set of task ids that conflict with another task on the same day
  const conflictIds = useMemo(() => {
    const ids = new Set<number>();
    for (const dayTasks of Object.values(tasksByDay)) {
      for (let i = 0; i < dayTasks.length; i++) {
        for (let j = i + 1; j < dayTasks.length; j++) {
          if (tasksOverlap(dayTasks[i], dayTasks[j])) {
            ids.add(dayTasks[i].id);
            ids.add(dayTasks[j].id);
          }
        }
      }
    }
    return ids;
  }, [tasksByDay]);

  const getDayTasks = (date: Date) => tasksByDay[date.toLocaleDateString("sv")] ?? [];

  const goPrev = () => {
    if (view === "month") setCursor((c) => addMonths(c, -1));
    else if (view === "week") setCursor((c) => addWeeks(c, -1));
    else setCursor((c) => addDays(c, -1));
  };
  const goNext = () => {
    if (view === "month") setCursor((c) => addMonths(c, 1));
    else if (view === "week") setCursor((c) => addWeeks(c, 1));
    else setCursor((c) => addDays(c, 1));
  };
  const goToday = () => setCursor(startOfDay(new Date()));

  const rangeLabel = useMemo(() => {
    if (view === "month") return format(cursor, "MMMM 'de' yyyy", { locale: ptBR });
    if (view === "week") {
      const start = startOfWeek(cursor, { weekStartsOn: 0 });
      const end = endOfWeek(cursor, { weekStartsOn: 0 });
      return `${format(start, "dd MMM", { locale: ptBR })} – ${format(end, "dd MMM yyyy", { locale: ptBR })}`;
    }
    return format(cursor, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  }, [cursor, view]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Agenda</h1>
          <p className="text-gray-500 mt-1">Visualize seus compromissos no calendário.</p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* View toggle */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {VIEWS.map((v) => (
              <Button
                key={v.value}
                variant={view === v.value ? "default" : "ghost"}
                size="sm"
                className="rounded-md"
                onClick={() => setView(v.value)}
              >
                {v.label}
              </Button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={goPrev} aria-label="Anterior">
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToday}>Hoje</Button>
            <Button variant="outline" size="icon" className="h-9 w-9" onClick={goNext} aria-label="Próximo">
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <p className="text-lg font-semibold text-gray-800 capitalize">{rangeLabel}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Carregando...
        </div>
      ) : view === "month" ? (
        <MonthView cursor={cursor} getDayTasks={getDayTasks} conflictIds={conflictIds} onSelect={setSelectedTask} />
      ) : view === "week" ? (
        <WeekView cursor={cursor} getDayTasks={getDayTasks} conflictIds={conflictIds} onSelect={setSelectedTask} />
      ) : (
        <DayView cursor={cursor} tasks={getDayTasks(cursor)} conflictIds={conflictIds} onSelect={setSelectedTask} />
      )}

      <TaskDetailDialog
        task={selectedTask}
        conflictIds={conflictIds}
        onClose={() => setSelectedTask(null)}
        updateMutation={updateMutation}
        onRescheduled={() => {
          queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetNotificationsQueryKey() });
          setSelectedTask(null);
          toast({ title: "Tarefa reagendada." });
        }}
        onError={(error: unknown) => {
          const apiError = error as ApiError;
          if (apiError?.status === 409) {
            toast({ title: "Conflito de agenda", description: apiError.message, variant: "destructive" });
          } else {
            toast({ title: "Erro ao reagendar", description: "Tente novamente.", variant: "destructive" });
          }
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Shared task chip                                                    */
/* ------------------------------------------------------------------ */

function TaskChip({
  task,
  conflict,
  onSelect,
  showTime = true,
}: {
  task: Task;
  conflict: boolean;
  onSelect: (t: Task) => void;
  showTime?: boolean;
}) {
  const info = taskStatusMap[task.status] ?? taskStatusMap.scheduled;
  const timeText = format(new Date(task.dueAt), "HH:mm");
  const endText = task.endAt ? format(new Date(task.endAt), "HH:mm") : null;
  return (
    <button
      type="button"
      onClick={() => onSelect(task)}
      title={conflict ? "Conflito de horário" : task.title}
      className={`w-full text-left rounded-md px-1.5 py-1 text-xs transition-colors hover:opacity-80 ${info.color} ${
        conflict ? "ring-2 ring-red-500" : ""
      }`}
    >
      <span className="flex items-center gap-1">
        {conflict && <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />}
        {showTime && <span className="font-semibold shrink-0">{timeText}{endText ? `–${endText}` : ""}</span>}
        <span className="truncate">{task.title}</span>
      </span>
      {conflict && <span className="text-[10px] font-semibold text-red-600">Conflito</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Month view                                                         */
/* ------------------------------------------------------------------ */

function MonthView({
  cursor,
  getDayTasks,
  conflictIds,
  onSelect,
}: {
  cursor: Date;
  getDayTasks: (d: Date) => Task[];
  conflictIds: Set<number>;
  onSelect: (t: Task) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [cursor]);

  return (
    <div className="bg-white border rounded-xl overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="text-center text-xs font-semibold text-gray-500 py-2">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dayTasks = getDayTasks(day);
          const inMonth = isSameMonth(day, cursor);
          const today = isToday(day);
          const visible = dayTasks.slice(0, 3);
          const extra = dayTasks.length - visible.length;
          return (
            <div
              key={day.toISOString()}
              className={`min-h-[92px] border-b border-r p-1 flex flex-col gap-1 ${inMonth ? "bg-white" : "bg-gray-50/50"}`}
            >
              <span
                className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full ${
                  today ? "bg-primary text-primary-foreground" : inMonth ? "text-gray-700" : "text-gray-300"
                }`}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-col gap-0.5">
                {visible.map((t) => (
                  <TaskChip key={t.id} task={t} conflict={conflictIds.has(t.id)} onSelect={onSelect} />
                ))}
                {extra > 0 && <span className="text-[10px] text-gray-400 px-1">+{extra} mais</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Week view                                                          */
/* ------------------------------------------------------------------ */

function WeekView({
  cursor,
  getDayTasks,
  conflictIds,
  onSelect,
}: {
  cursor: Date;
  getDayTasks: (d: Date) => Task[];
  conflictIds: Set<number>;
  onSelect: (t: Task) => void;
}) {
  const days = useMemo(() => {
    const start = startOfWeek(cursor, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
      {days.map((day) => {
        const dayTasks = getDayTasks(day);
        const today = isToday(day);
        return (
          <div key={day.toISOString()} className="bg-white border rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[120px]">
            <div className={`px-2 py-1.5 border-b text-center ${today ? "bg-primary text-primary-foreground" : "bg-gray-50"}`}>
              <p className="text-[11px] uppercase font-semibold opacity-80">{format(day, "EEE", { locale: ptBR })}</p>
              <p className="text-sm font-bold">{format(day, "dd/MM")}</p>
            </div>
            <div className="p-1.5 flex flex-col gap-1 flex-1">
              {dayTasks.length === 0 ? (
                <span className="text-[11px] text-gray-300 text-center mt-2">—</span>
              ) : (
                dayTasks.map((t) => (
                  <TaskChip key={t.id} task={t} conflict={conflictIds.has(t.id)} onSelect={onSelect} />
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Day view                                                           */
/* ------------------------------------------------------------------ */

function DayView({
  cursor,
  tasks,
  conflictIds,
  onSelect,
}: {
  cursor: Date;
  tasks: Task[];
  conflictIds: Set<number>;
  onSelect: (t: Task) => void;
}) {
  return (
    <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
      <div className={`px-4 py-3 border-b ${isToday(cursor) ? "bg-primary/5" : "bg-gray-50"}`}>
        <p className="text-sm font-semibold text-gray-800 capitalize">
          {format(cursor, "EEEE, dd 'de' MMMM", { locale: ptBR })}
        </p>
      </div>
      {tasks.length === 0 ? (
        <div className="h-40 flex items-center justify-center text-gray-400 text-sm">
          Nenhuma tarefa para este dia.
        </div>
      ) : (
        <ul className="divide-y">
          {tasks.map((t) => {
            const info = taskStatusMap[t.status] ?? taskStatusMap.scheduled;
            const conflict = conflictIds.has(t.id);
            const start = new Date(t.dueAt);
            const end = t.endAt ? new Date(t.endAt) : null;
            return (
              <li key={t.id}>
                <button
                  type="button"
                  onClick={() => onSelect(t)}
                  className={`w-full text-left flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${
                    conflict ? "ring-2 ring-inset ring-red-500" : ""
                  }`}
                >
                  <div className="text-sm font-semibold text-gray-700 w-20 shrink-0">
                    {format(start, "HH:mm")}
                    {end && <div className="text-xs font-normal text-gray-400">até {format(end, "HH:mm")}</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{t.title}</p>
                    {t.clientName && <p className="text-sm text-gray-500 truncate">{t.clientName}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={`${info.color} text-xs`}>{info.label}</Badge>
                      {conflict && (
                        <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Conflito
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Task detail + reschedule dialog                                    */
/* ------------------------------------------------------------------ */

function TaskDetailDialog({
  task,
  conflictIds,
  onClose,
  updateMutation,
  onRescheduled,
  onError,
}: {
  task: Task | null;
  conflictIds: Set<number>;
  onClose: () => void;
  updateMutation: ReturnType<typeof useUpdateTask>;
  onRescheduled: () => void;
  onError: (error: unknown) => void;
}) {
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [endDate, setEndDate] = useState("");
  const [endTime, setEndTime] = useState("");
  // Track which task we've synced the form to, so inputs reset when the task changes.
  const [syncedId, setSyncedId] = useState<number | null>(null);

  if (task && task.id !== syncedId) {
    const start = new Date(task.dueAt);
    setDate(start.toLocaleDateString("sv"));
    setTime(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
    const end = task.endAt ? new Date(task.endAt) : start;
    setEndDate(end.toLocaleDateString("sv"));
    setEndTime(task.endAt ? `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}` : "17:00");
    setSyncedId(task.id);
  }

  const handleReschedule = () => {
    if (!task || !date || !time || !endDate || !endTime) return;
    const [h, m] = time.split(":").map(Number);
    const newStart = new Date(date + "T12:00:00");
    newStart.setHours(h, m, 0, 0);
    const newDueAtISO = newStart.toISOString();

    const [endHours, endMinutes] = endTime.split(":").map(Number);
    const newEnd = new Date(endDate + "T12:00:00");
    newEnd.setHours(endHours, endMinutes, 0, 0);
    if (newEnd <= newStart) {
      onError(new Error("O término deve ser posterior ao início."));
      return;
    }

    updateMutation.mutate(
      { id: task.id, data: { dueAt: newDueAtISO, endAt: newEnd.toISOString() } },
      { onSuccess: onRescheduled, onError },
    );
  };

  const info = task ? (taskStatusMap[task.status] ?? taskStatusMap.scheduled) : null;
  const conflict = task ? conflictIds.has(task.id) : false;

  return (
    <Dialog open={!!task} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        {task && info && (
          <>
            <DialogHeader>
              <DialogTitle>{task.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-1 text-sm">
              {task.clientName && (
                <p className="flex items-center gap-2 text-gray-600">
                  <User className="w-4 h-4 text-gray-400" /> {task.clientName}
                </p>
              )}
              <p className="text-gray-600">
                {format(new Date(task.dueAt), "EEEE, dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                {task.endAt && ` — até ${format(new Date(task.endAt), "HH:mm")}`}
              </p>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={`${info.color} text-xs`}>{info.label}</Badge>
                {conflict && (
                  <span className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Conflito de horário
                  </span>
                )}
              </div>

              <div className="border-t pt-3 space-y-3">
                <p className="font-medium text-gray-700">Reagendar</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="reschedule-date">Data</Label>
                    <Input id="reschedule-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reschedule-time">Início</Label>
                    <Input id="reschedule-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reschedule-end-date">Data de término</Label>
                    <Input id="reschedule-end-date" type="date" min={date} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="reschedule-end-time">Término</Label>
                    <Input id="reschedule-end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                  </div>
                </div>
                {!task.endAt && <p className="text-xs text-amber-600">Este serviço antigo não tinha término. Defina-o para liberar outros horários no mesmo dia.</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Fechar</Button>
              <Button onClick={handleReschedule} disabled={updateMutation.isPending || !date || !time || !endDate || !endTime}>
                {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Reagendar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
