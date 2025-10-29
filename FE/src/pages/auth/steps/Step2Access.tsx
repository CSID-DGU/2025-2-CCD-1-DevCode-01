import { useNavigate, useOutletContext } from "react-router-dom";
import { useEffect } from "react";
import styled from "styled-components";
import { useSignup } from "src/features/signup/useSignup";
import { useContrastMode } from "@shared/useContrastMode";
import { fonts } from "@styles/fonts";

type ShellContext = {
  setControls: (
    c: Partial<{
      title: string;
      btn: string;
      onSubmit: () => void;
      submitDisabled: boolean;
    }>
  ) => void;
};

export default function Step2Access() {
  const { access, setAccess } = useSignup();
  const navigate = useNavigate();
  const { setControls } = useOutletContext<ShellContext>();
  const { isHC, toggleMode } = useContrastMode();

  useEffect(() => {
    setControls({
      title: "화면 크기와 화면 대비를 설정해주세요",
      btn: "다음",
      onSubmit: () => navigate("/signup/3"),
      submitDisabled: false,
    });
  }, [navigate, setControls]);

  // 화면 크기 변경
  const handleScale = (scale: number) => setAccess({ fontScale: scale });

  // 화면 대비 변경 (전역 고대비 모드 동기화)
  const handleContrast = (contrast: "base" | "hc") => {
    setAccess({ contrast });
    if ((contrast === "hc" && !isHC) || (contrast === "base" && isHC)) {
      toggleMode();
    }
  };

  return (
    <Wrapper>
      <Group>
        <Title>화면 크기</Title>
        <Options>
          {[
            { label: "보통", scale: 1 },
            { label: "조금 크게", scale: 1.2 },
            { label: "크게", scale: 1.4 },
            { label: "가장 크게", scale: 1.6 },
          ].map((opt) => (
            <Option key={opt.scale}>
              <Radio
                id={`scale-${opt.scale}`}
                name="fontScale"
                checked={access.fontScale === opt.scale}
                onChange={() => handleScale(opt.scale)}
              />
              <Label htmlFor={`scale-${opt.scale}`}>{opt.label}</Label>
            </Option>
          ))}
        </Options>
      </Group>

      <Group>
        <Title>화면 대비</Title>
        <ContrastBox>
          {/* 기본 화면 미리보기 + 라디오 */}
          <Preview $active={!isHC}>
            <img src="/img/login/baseScreen.png" alt="" aria-hidden />
          </Preview>
          <Option>
            <Radio
              id="contrast-base"
              name="contrast"
              checked={!isHC}
              onChange={() => handleContrast("base")}
            />
            <Label htmlFor="contrast-base">기본 화면</Label>
          </Option>

          {/* 고대비 화면 미리보기 + 라디오 */}
          <Preview $active={isHC}>
            <img src="/img/login/hcScreen.png" alt="" aria-hidden />
          </Preview>
          <Option>
            <Radio
              id="contrast-hc"
              name="contrast"
              checked={isHC}
              onChange={() => handleContrast("hc")}
            />
            <Label htmlFor="contrast-hc">고대비 화면</Label>
          </Option>
        </ContrastBox>
      </Group>
    </Wrapper>
  );
}

/* ---------- styled ---------- */

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 10rem;
  margin-top: 24px;
  width: 100%;
`;

const Group = styled.section`
  display: flex;
  flex-direction: column;
  gap: 30px;
`;

const Title = styled.h2`
  font-size: 1.25rem;
  font-weight: 700;
  margin-bottom: 4px;
`;

const Options = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Option = styled.div`
  display: flex;
  align-items: center;
`;

const Label = styled.label`
  cursor: pointer;
  ${fonts.regular20}
`;

const Radio = styled.input.attrs({ type: "radio" })`
  margin-right: 15px;
  accent-color: var(--c-radio-accent, var(--c-blue));
  cursor: pointer;
`;

const ContrastBox = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 31px 35px;
  align-items: center;
`;

const Preview = styled.div<{ $active: boolean }>`
  width: 157.5px;
  height: 112px;
  border: 2px solid
    ${({ $active }) => ($active ? "var(--c-blue)" : "var(--c-grayD)")};
  border-radius: 6px;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;
