import { useContrastImage } from "@shared/useContrastImage";
import * as s from "./Login_style";
import InputField from "@layouts/components/login/InputContainer";
import { useNavigate } from "react-router-dom";

const Login = () => {
  const logo = useContrastImage("/img/login/logoBig");
  const navigate = useNavigate();

  const handleSignupClick = () => {
    navigate("/signup");
  };

  return (
    <s.LoginWrapper>
      <s.LoginLeftContainer>
        <s.LoginLeftBg />
        <img src={logo} />
        <h1>CAMPUS MATE</h1>
      </s.LoginLeftContainer>
      <s.LoginRightContaienr>
        <h1>캠퍼스 메이트에 오신 것을 환영합니다.</h1>
        <s.InputContainer>
          <InputField label="아이디" placeholder="아이디를 입력하세요" />
          <InputField label="비밀번호" placeholder="비밀번호 입력하세요" />
          <button>로그인</button>
          <s.SignupContainer>
            <p>캠퍼스 메이트가 처음이신가요?</p>
            <p className="signup" onClick={handleSignupClick}>
              회원가입
            </p>
          </s.SignupContainer>
        </s.InputContainer>
      </s.LoginRightContaienr>
    </s.LoginWrapper>
  );
};

export default Login;
