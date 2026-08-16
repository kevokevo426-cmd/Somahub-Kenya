import "./globals.css";

export const metadata = {
  title: "SomaHub Kenya",
  description: "Learning resources for Kenyan learners and teachers.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <header style={{ padding: "18px 30px", borderBottom: "1px solid #ddd", background: "white" }}>
          <a href="/" style={{ fontSize: "24px", fontWeight: "bold", textDecoration: "none", color: "#1769aa" }}>
            SomaHub Kenya
          </a>
          <nav style={{ marginTop: "12px" }}>
            <a href="/resources" style={{ marginRight: "20px" }}>Resources</a>
            <a href="/subscription" style={{ marginRight: "20px" }}>Subscribe</a>
          </nav>
        </header>
        {children}
        <footer style={{ marginTop: "50px", padding: "30px", background: "#172033", color: "white", textAlign: "center" }}>
          SomaHub Kenya © 2026
        </footer>
      </body>
    </html>
  );
}
