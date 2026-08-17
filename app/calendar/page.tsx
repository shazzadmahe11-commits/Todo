import CalendarBoard from "@/components/CalendarBoard";

export default function CalendarPage() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", letterSpacing: "-0.4px" }}>History</h1>
        <p style={{ fontSize: 13, color: "var(--text3)", marginTop: 3 }}>Tasks you've completed</p>
      </div>
      <CalendarBoard />
    </div>
  );
}
