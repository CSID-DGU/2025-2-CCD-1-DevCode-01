import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as s from "./Login_style";
import InputField from "@layouts/components/login/InputContainer";
import { useContrastImage } from "@shared/useContrastImage";
import { loginApi } from "@apis/auth/login";
import { applyUiScale } from "@shared/applyUiScale";

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

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      alert("아이디와 비밀번호를 입력하세요.");
      return;
    }

    try {
      setBusy(true);

      const res = await loginApi({ username, password });
      if (!res) {
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

      try {
        applyUiScale?.(r.font);

        const root = document.documentElement;
        if (r.high_contrast) root.classList.add("hc");
        else root.classList.remove("hc");
      } catch {
        // 적용 함수가 없거나 에러여도 로그인 자체 흐름엔 영향 없음
      }

      navigate("/");
    } catch (e) {
      console.error("로그인 오류:", e);
      alert("로그인 중 오류가 발생했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const handleSignupClick = () => {
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
          />

          <InputField
            label="비밀번호"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !busy) handleLogin();
            }}
          />

          <button
            onClick={handleLogin}
            disabled={busy}
            aria-busy={busy}
            aria-label="로그인"
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
