import styled from "styled-components";

export type StepperProps = {
  current: number;
  total: number;
  labels?: string[];
  color?: string;
  inactiveColor?: string;
};

const Stepper = ({
  current,
  total,
  labels = [],
  color = "var(--c-blue)",
  inactiveColor = "var(--c-grayL)",
}: StepperProps) => {
  return (
    <Nav aria-label="진행 단계">
      <List role="list">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const active = n === current;
          const passed = n < current;
          const label = labels[i] ?? `${n} / ${total} 단계`;
          return (
            <Item role="listitem" key={n}>
              <Dot
                aria-current={active ? "step" : undefined}
                aria-label={label}
                title={label}
                $active={active}
                $color={color}
                $inactive={inactiveColor}
              >
                {n}
              </Dot>
              {n !== total && (
                <Bar
                  $active={passed}
                  $color={color}
                  $inactive={inactiveColor}
                />
              )}
            </Item>
          );
        })}
      </List>
    </Nav>
  );
};

export default Stepper;

/* styled */
const Nav = styled.nav`
  width: 100%;
  display: flex;
  justify-content: center;
`;

const List = styled.ol`
  display: flex;
  align-items: center;
  gap: 10px;
  list-style: none;
  padding: 0;
  margin: 0;
`;

const Item = styled.li`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const Dot = styled.span<{
  $active: boolean;
  $color: string;
  $inactive: string;
}>`
  width: 21px;
  height: 21px;
  border-radius: 999px;
  display: grid;
  place-items: center;
  font-weight: 800;
  color: ${({ $active }) => ($active ? "var(--c-white)" : "#8A93A4")};
  background: ${({ $active, $color }) => ($active ? $color : "var(--c-grayL)")};
`;

const Bar = styled.span<{
  $active: boolean;
  $color: string;
  $inactive: string;
}>`
  width: 39px;
  height: 3px;
  border-radius: 99px;
  background: ${({ $active, $color, $inactive }) =>
    $active ? $color : $inactive};
`;
