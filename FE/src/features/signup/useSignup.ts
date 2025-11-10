import { useContext } from "react";
import { SignupContext } from "./context";

export function useSignup() {
  const ctx = useContext(SignupContext);
  if (!ctx) throw new Error("useSignup must be used within <SignupProvider />");
  return ctx;
}
