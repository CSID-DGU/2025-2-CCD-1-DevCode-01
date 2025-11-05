import { useNavigate, useOutletContext } from "react-router-dom";
import { useEffect } from "react";
import styled from "styled-components";
import { useSignup } from "src/features/signup/useSignup";
import { useContrastMode } from "@shared/useContrastMode";

import { fonts } from "@styles/fonts";
import { applyUiScale } from "@shared/applyUiScale";

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

  useEffect(() => {
    if (access.font) applyUiScale(access.font);
  }, [access.font]);

  const handleScale = (scale: number) => {
    setAccess({ font: scale });
    applyUiScale(scale);
  };

  const handleContrast = (high_contrast: boolean) => {
    setAccess({ high_contrast });
    if (high_contrast !== isHC) toggleMode();
  };

  const SIZE_OPTIONS = [
    { label: "보통", scale: 125 },
    { label: "크게", scale: 150 },
    { label: "매우 크게", scale: 175 },
    { label: "가장 크게", scale: 200 },
  ] as const;

  const currentScale = Number(access.font ?? 125);

  return (
    <Wrapper>
      <Group aria-labelledby="size-title">
        <Title id="size-title">화면 크기</Title>
        <Options role="radiogroup" aria-label="화면 크기 선택">
          {SIZE_OPTIONS.map((opt) => (
            <Option key={opt.scale}>
              <Radio
                id={`scale-${opt.scale}`}
                name="fontScale"
                value={opt.scale}
                checked={currentScale === opt.scale}
                onChange={() => handleScale(opt.scale)}
                aria-checked={currentScale === opt.scale}
              />
              <Label htmlFor={`scale-${opt.scale}`}>{opt.label}</Label>
            </Option>
          ))}
        </Options>
      </Group>

      <Group aria-labelledby="contrast-title">
        <Title id="contrast-title">화면 대비</Title>
        <ContrastBox>
          {/* 기본 화면 미리보기 */}
          <Preview $active={!isHC}>
            <img src="/img/login/baseScreen.png" alt="" aria-hidden />
          </Preview>
          <Option>
            <Radio
              id="contrast-base"
              name="contrast"
              checked={!isHC}
              onChange={() => handleContrast(false)}
              aria-checked={!isHC}
            />
            <Label htmlFor="contrast-base">기본 화면</Label>
          </Option>

          {/* 고대비 화면 미리보기 */}
          <Preview $active={isHC}>
            <img src="/img/login/hcScreen.png" alt="" aria-hidden />
          </Preview>
          <Option>
            <Radio
              id="contrast-hc"
              name="contrast"
              checked={isHC}
              onChange={() => handleContrast(true)}
              aria-checked={isHC}
            />
            <Label htmlFor="contrast-hc">고대비 화면</Label>
          </Option>
        </ContrastBox>
      </Group>
    </Wrapper>
  );
}

/* ----------------------------- styled ----------------------------- */

const Wrapper = styled.div`
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: 10rem;
  margin-top: 24px;
  width: 100%;

  @media (max-width: 960px) {
    gap: 4rem;
  }
  @media (max-width: 720px) {
    flex-direction: column;
    gap: 2rem;
  }
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
  color: var(--c-black);

  html.hc & {
    color: var(--c-white);
  }
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
  color: var(--c-black);

  html.hc & {
    color: var(--c-white);
  }
`;

const Radio = styled.input.attrs({ type: "radio" })`
  margin-right: 15px;
  accent-color: var(--c-radio-accent, var(--c-blue));
  cursor: pointer;

  &:focus-visible {
    outline: 3px solid var(--c-blue);
    outline-offset: 2px;

    html.hc & {
      outline-color: var(--c-yellowM);
    }
  }
`;

const ContrastBox = styled.div`
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 31px 35px;
  align-items: center;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
    gap: 16px;
  }
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

  html.hc & {
    border-color: ${({ $active }) =>
      $active ? "var(--c-yellowM)" : "var(--c-beige)"};
  }

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;
