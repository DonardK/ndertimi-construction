"use client";

import { useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { toAuthEmail } from "@/lib/auth-email";
import { t } from "@/lib/translations";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setDetail(null);
    const email = toAuthEmail(username);
    if (!email) {
      setError(t.auth.missingCredentials);
      return;
    }
    if (!password) {
      setError(t.auth.missingCredentials);
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr) {
        setError(t.auth.loginFailed);
        setDetail(signErr.message);
        return;
      }
      window.location.href = "/";
    } catch (err: unknown) {
      setError(t.auth.loginFailed);
      setDetail(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-12 bg-slate-100">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-extrabold text-gray-900 text-center mb-1">
          {t.appName}
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">{t.auth.loginTitle}</p>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 flex flex-col gap-4"
        >
          {(error || detail) && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm">
              {error && <p className="font-semibold text-red-800">{error}</p>}
              {detail && (
                <p className="mt-1 font-mono text-xs text-red-700 break-all whitespace-pre-wrap">
                  {detail}
                </p>
              )}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {t.auth.usernameLabel}
            </label>
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t.auth.usernamePlaceholder}
              className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 text-gray-900 font-medium focus:outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              {t.auth.passwordLabel}
            </label>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full h-12 px-4 rounded-xl border-2 border-gray-200 text-gray-900 font-medium focus:outline-none focus:border-blue-500"
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 h-14 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t.common.loading}
              </>
            ) : (
              t.auth.signIn
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
