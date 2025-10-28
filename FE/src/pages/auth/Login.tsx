import { useContrastImage } from "@shared/useContrastImage";
import * as s from "./Login_style";

const Login = () => {
  const logo = useContrastImage("/img/login/logoBig");

  return (
    <s.LoginWrapper>
      <s.LoginLeftContainer>
        <s.LoginLeftBg />
        <img src={logo} />
        <h1>CAMPUS MATE</h1>
      </s.LoginLeftContainer>
      <s.LoginRightContaienr></s.LoginRightContaienr>
    </s.LoginWrapper>
  );
};

export default Login;
