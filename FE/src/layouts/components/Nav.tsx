import { useContrastMode } from "@shared/useContrastMode";
import * as s from "./style";

const Nav = () => {
  const { isHC, toggleMode } = useContrastMode();

  return (
    <s.NavWrapper>
      <s.ToggleButton onClick={toggleMode} aria-pressed={isHC}>
        {isHC ? "고대비 ON" : "고대비 OFF"}
      </s.ToggleButton>
    </s.NavWrapper>
  );
};

export default Nav;
