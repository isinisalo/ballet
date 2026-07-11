import { useState, type ReactNode } from "react";
import { KeyRound, LoaderCircle, Route } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useAdminSession } from "./useAdminSession";

export function AdminGate({ children }: { children: ReactNode }) {
  const session = useAdminSession();
  const [password, setPassword] = useState("");

  if (session.loading) {
    return <div className="grid min-h-svh place-items-center bg-background text-muted-foreground"><LoaderCircle className="animate-spin" aria-label="Loading admin session" /></div>;
  }
  if (session.status?.authenticated) return children;

  const bootstrapping = !session.status?.bootstrapped;
  return (
    <main className="grid min-h-svh place-items-center bg-background p-4">
      <Card className="w-full max-w-md border-border bg-card">
        <CardHeader className="gap-3">
          <div className="flex size-9 items-center justify-center rounded bg-primary text-primary-foreground"><Route className="size-5" /></div>
          <CardTitle>{bootstrapping ? "Create Ballet admin" : "Admin sign in"}</CardTitle>
          <CardDescription>
            {bootstrapping
              ? "Create the single local administrator before connecting a computer."
              : "Authenticate to manage runtimes, attachments, and runs."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={(event) => { event.preventDefault(); void session.authenticate(password); }}>
            {session.error ? <Alert variant="destructive"><AlertDescription>{session.error}</AlertDescription></Alert> : null}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="admin-password">Password</FieldLabel>
                <Input
                  id="admin-password"
                  type="password"
                  autoComplete={bootstrapping ? "new-password" : "current-password"}
                  minLength={12}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                {bootstrapping ? <FieldDescription>Use at least 12 characters. This credential stays in the local control plane.</FieldDescription> : null}
              </Field>
            </FieldGroup>
            <Button type="submit" disabled={session.submitting || password.length < 12}>
              {session.submitting ? <LoaderCircle className="animate-spin" /> : <KeyRound />}
              {bootstrapping ? "Create admin" : "Sign in"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
