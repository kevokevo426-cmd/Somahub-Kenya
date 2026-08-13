export default function Home() {
  return (
    <main>
      <section
        style={{
          padding: "70px 20px",
          textAlign: "center",
          background: "#eef7ff",
        }}
      >
        <h1>SomaHub Kenya</h1>

        <p style={{ fontSize: "20px" }}>
          Learn. Download. Grow.
        </p>

        <p>
          Learning resources, revision materials and teacher resources
          for Kenyan learners and educators.
        </p>

        <div style={{ marginTop: "30px" }}>
          <a
            href="/resources"
            style={{
              margin: "10px",
              padding: "14px 20px",
              background: "#1769aa",
              color: "white",
              textDecoration: "none",
              borderRadius: "8px",
              display: "inline-block",
            }}
          >
            Explore Resources
          </a>

          <a
            href="/subscription"
            style={{
              margin: "10px",
              padding: "14px 20px",
              background: "white",
              color: "#1769aa",
              textDecoration: "none",
              borderRadius: "8px",
              display: "inline-block",
              border: "1px solid #1769aa",
            }}
          >
            Subscribe — KSh 500/Term
          </a>
        </div>
      </section>

      <section
        style={{
          padding: "50px 20px",
          textAlign: "center",
        }}
      >
        <h2>What SomaHub Offers</h2>

        <div
          style={{
            display: "flex",
            gap: "20px",
            justifyContent: "center",
            flexWrap: "wrap",
            marginTop: "30px",
          }}
        >
          <div>
            <h3>📚 Resources</h3>
            <p>Learning materials by grade and subject.</p>
          </div>

          <div>
            <h3>📝 Revision</h3>
            <p>Materials for practice and preparation.</p>
          </div>

          <div>
            <h3>👨‍🏫 Teachers</h3>
            <p>Resources to support classroom work.</p>
          </div>

          <div>
            <h3>🔐 Downloads</h3>
            <p>Protected resources for subscribers.</p>
          </div>
        </div>
      </section>
    </main>
  );
}-
