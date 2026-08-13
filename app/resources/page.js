export default function Resources() {
  return (
    <main style={{ padding: "40px 20px", maxWidth: "1000px", margin: "auto" }}>
      <h1>Learning Resources</h1>

      <p>
        Find learning and revision materials on SomaHub Kenya.
      </p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "20px",
        marginTop: "30px"
      }}>
        <div style={{
          background: "#f5f7fb",
          padding: "25px",
          borderRadius: "12px"
        }}>
          <h2>Grade 6</h2>
          <p>Learning and revision materials.</p>
        </div>

        <div style={{
          background: "#f5f7fb",
          padding: "25px",
          borderRadius: "12px"
        }}>
          <h2>Grade 7</h2>
          <p>Learning and revision materials.</p>
        </div>

        <div style={{
          background: "#f5f7fb",
          padding: "25px",
          borderRadius: "12px"
        }}>
          <h2>Grade 8</h2>
          <p>Learning and revision materials.</p>
        </div>

        <div style={{
          background: "#f5f7fb",
          padding: "25px",
          borderRadius: "12px"
        }}>
          <h2>Grade 9</h2>
          <p>Learning and revision materials.</p>
        </div>
      </div>

      <p style={{ marginTop: "40px" }}>
        🔐 Subscriber resources will be available after subscription.
      </p>
    </main>
  );
  }
