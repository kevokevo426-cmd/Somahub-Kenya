export default function Subscription() {
  return (
    <main style={{
      padding: "40px 20px",
      maxWidth: "600px",
      margin: "auto"
    }}>
      <h1>SomaHub Kenya Subscription</h1>

      <div style={{
        padding: "25px",
        background: "#eef7ff",
        borderRadius: "12px",
        marginTop: "25px"
      }}>
        <h2>KSh 500 per term</h2>

        <p>
          Subscribe to access premium learning resources
          and downloads.
        </p>

        <h3>M-Pesa Payment</h3>

        <p>
          Send <strong>KSh 500</strong> to:
        </p>

        <h2>0718422377</h2>

        <p>
          After payment, keep your M-Pesa transaction code
          for confirmation.
        </p>
      </div>

      <form style={{ marginTop: "30px" }}>
        <label>Email</label>
        <br />
        <input
          type="email"
          placeholder="Enter your email"
          required
          style={{
            width: "100%",
            padding: "12px",
            margin: "8px 0 18px"
          }}
        />

        <label>Phone Number</label>
        <br />
        <input
          type="tel"
          placeholder="07XXXXXXXX"
          required
          style={{
            width: "100%",
            padding: "12px",
            margin: "8px 0 18px"
          }}
        />

        <label>M-Pesa Transaction Code</label>
        <br />
        <input
          type="text"
          placeholder="Enter transaction code"
          required
          style={{
            width: "100%",
            padding: "12px",
            margin: "8px 0 18px"
          }}
        />

        <button
          type="submit"
          style={{
            padding: "14px 20px",
            background: "#1769aa",
            color: "white",
            border: "none",
            borderRadius: "8px",
            fontWeight: "bold"
          }}
        >
          Submit Payment
        </button>
      </form>
    </main>
  );
            }
