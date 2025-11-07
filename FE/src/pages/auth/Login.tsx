import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as s from "./Login_style";
import InputField from "@layouts/components/login/InputContainer";
import { useContrastImage } from "@shared/useContrastImage";
import { loginApi } from "@apis/auth/login";

import { TTSContext } from "@shared/tts/TTSProvider";
import { useFocusSpeak } from "@shared/tts/useFocusSpeak";

import { setA11yAndApply } from "@shared/a11y/initA11y";
import { normalizeFontToPct } from "@shared/a11y/a11y.mappers";

type LoginOk = {
  access: string;
  refresh: string;
  role: string;
  font: number;
  high_contrast: boolean;
  username: string;
  message?: string;
};

const Login = () => {
  const logo = useContrastImage("/img/login/logoBig");
  const navigate = useNavigate();
  const tts = useContext(TTSContext);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const idSpeak = useFocusSpeak({ text: "아이디 입력" });
  const pwSpeak = useFocusSpeak({ text: "비밀번호 입력" });
  const loginBtnSpeak = useFocusSpeak({ text: "로그인 버튼" });
  const signupLinkSpeak = useFocusSpeak({ text: "회원가입 이동 링크" });

  const handleLogin = async () => {
    if (!username || !password) {
      tts?.speak("아이디와 비밀번호를 입력하세요.");
      alert("아이디와 비밀번호를 입력하세요.");
      return;
    }

    try {
      setBusy(true);

      const res = await loginApi({ username, password });
      if (!res) {
        tts?.speak("아이디나 비밀번호를 확인하세요.");
        alert("아이디나 비밀번호를 확인하세요.");
        return;
      }

      const r = res as LoginOk;

      localStorage.setItem("access", r.access);
      localStorage.setItem("refresh", r.refresh);
      localStorage.setItem("role", r.role);
      localStorage.setItem("font", String(r.font));
      localStorage.setItem("high_contrast", String(r.high_contrast));
      localStorage.setItem("username", r.username);

      setA11yAndApply({
        font: normalizeFontToPct(r.font),
        high_contrast: r.high_contrast,
      });

      const root = document.documentElement;
      if (r.high_contrast) root.classList.add("hc");
      else root.classList.remove("hc");

      tts?.speak("로그인 되었습니다. 홈으로 이동합니다.");
      navigate("/");
    } catch (e) {
      console.error("로그인 오류:", e);
      tts?.speak("로그인 중 오류가 발생했습니다.");
      alert("로그인 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignupClick = () => {
    tts?.speak("회원가입으로 이동합니다.");
    navigate("/signup");
  };

  return (
    <s.LoginWrapper>
      <s.LoginLeftContainer>
        <s.LoginLeftBg />
        <img src={logo} alt="Campus Mate 로고" />
        <h1>CAMPUS MATE</h1>
      </s.LoginLeftContainer>

      <s.LoginRightContaienr>
        <h1>캠퍼스 메이트에 오신 것을 환영합니다.</h1>

        <s.InputContainer>
          <InputField
            label="아이디"
            placeholder="아이디를 입력하세요"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onFocus={idSpeak.onFocus}
            onBlur={idSpeak.onBlur}
          />

          <InputField
            label="비밀번호"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onFocus={pwSpeak.onFocus}
            onBlur={pwSpeak.onBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) handleLogin();
            }}
          />

          <button
            onClick={handleLogin}
            disabled={busy}
            aria-busy={busy}
            aria-label="로그인"
            {...loginBtnSpeak}
          >
            로그인
          </button>

          <s.SignupContainer>
            <p>캠퍼스 메이트가 처음이신가요?</p>
            <p
              className="signup"
              onClick={handleSignupClick}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && handleSignupClick()}
              {...signupLinkSpeak}
            >
              회원가입
            </p>
          </s.SignupContainer>
        </s.InputContainer>
      </s.LoginRightContaienr>
    </s.LoginWrapper>
  );
};

export default Login;
