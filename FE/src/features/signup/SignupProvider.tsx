import * as React from "react";
import { SignupContext } from "./context";
import type { Role, Access, TTS, Info, SignupCtx } from "./types";

type Props = { children: React.ReactNode };

export function SignupProvider({ children }: Props) {
  const [role, setRole] = React.useState<Role>("student");
  const [access, setAccessState] = React.useState<Access>({
    font: 100,
    high_contrast: false,
  });
  const [tts, setTtsState] = React.useState<TTS>({
    voice: "female",
    rate: 1,
  });
  const [info, setInfoState] = React.useState<Info>({
    username: "",
    password: "",
  });

  const setAccess = (p: Partial<Access>) =>
    setAccessState((prev) => ({ ...prev, ...p }));
  const setTts = (p: Partial<TTS>) =>
    setTtsState((prev) => ({ ...prev, ...p }));
  const setInfo = (p: Partial<Info>) =>
    setInfoState((prev) => ({ ...prev, ...p }));

  const value = React.useMemo<SignupCtx>(
    () => ({ role, setRole, access, setAccess, tts, setTts, info, setInfo }),
    [role, access, tts, info]
  );

  return (
    <SignupContext.Provider value={value}>{children}</SignupContext.Provider>
  );
}
