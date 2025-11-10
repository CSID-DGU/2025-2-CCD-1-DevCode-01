import * as React from "react";
import type { SignupCtx } from "./types";

export const SignupContext = React.createContext<SignupCtx | null>(null);
