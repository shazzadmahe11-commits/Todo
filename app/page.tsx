import TaskBoard from "@/components/TaskBoard";

export const metadata = {
  title: "Kamla.",
};

export default function HomePage() {
  return (
    <div>
      <div className="mb-6 px-1">
        <h1 className="font-display text-2xl italic grad-text select-none leading-none">Today</h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">What needs doing</p>
      </div>
      <TaskBoard />
    </div>
  );
}
