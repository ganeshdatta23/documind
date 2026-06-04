import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your DocuMind workspace",
};

const FEATURES = [
  "Hybrid retrieval — semantic vectors + keyword, fused",
  "Streaming answers with inline, verifiable citations",
  "Enterprise multi-tenancy, roles, and audit trails",
];

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Left — brand panel */}
      <div className="relative hidden w-[52%] flex-col justify-between overflow-hidden border-r border-line bg-sunken p-14 lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(42rem 30rem at 12% 0%, color-mix(in srgb, var(--accent) 12%, transparent), transparent 60%), radial-gradient(34rem 26rem at 100% 100%, color-mix(in srgb, var(--info) 10%, transparent), transparent 60%)",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fg text-canvas">
            <span className="text-base font-bold leading-none">D</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-fg">DocuMind</span>
        </div>

        <div className="relative max-w-md">
          <p className="eyebrow mb-5">Document Intelligence</p>
          <h1 className="text-display text-fg">
            Ask your documents.
            <br />
            Cite every answer.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted">
            Upload your knowledge base and query it in plain language — every
            answer is grounded in your sources, with citations you can verify.
          </p>

          <ul className="mt-10 space-y-3.5">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3 text-sm text-muted">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                {f}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-subtle">
          © {new Date().getFullYear()} DocuMind · Enterprise document intelligence
        </p>
      </div>

      {/* Right — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">{children}</div>
    </div>
  );
}
