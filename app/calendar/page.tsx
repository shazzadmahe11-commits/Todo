import CalendarBoard from "@/components/CalendarBoard";

export const metadata = {
  title: "Kamla. — History",
};

export default function CalendarPage() {
  return (
    <div>
      <div className="mb-6 px-1">
        <h1 className="font-display text-2xl italic grad-text select-none leading-none">History</h1>
        <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-muted">Completed tasks</p>
      </div>
      <CalendarBoard />
    </div>
  );
}
