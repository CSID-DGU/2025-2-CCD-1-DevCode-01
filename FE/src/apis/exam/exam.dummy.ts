// src/apis/exam/exam.dummy.ts
import type { ExamResultResponse } from "./exam.api";

export const DUMMY_EXAM_RESULT: ExamResultResponse = {
  endTime: "2025-12-30T07:35:00+09:00",
  questions: [
    {
      questionNumber: 3,
      questionImagePath:
        "https://capusmate.s3.amazonaws.com/exam/questions/8f25757bdcd84bc88a7e4f2970cf431e/q31_full.png",
      items: [
        {
          kind: "qnum",
          imagePath:
            "https://capusmate.s3.amazonaws.com/exam/items/8f25757bdcd84bc88a7e4f2970cf431e/q31_00_qnum.png",
          displayText:
            "[문제 3] 다음은 어떤 학생에 대한 설명이다. [A4 2쪽 이내, 총 24점]",
        },
        {
          kind: "text",
          imagePath:
            "https://capusmate.s3.amazonaws.com/exam/items/8f25757bdcd84bc88a7e4f2970cf431e/q31_01_text.png",
          displayText:
            '춘수는 친구를 좋아하고 늘 먼저 인사하는 학생이다. 춘수는 정신적으로 발달하지 못해 문제를 겪으며, 화장실을 가거나 이동할 때 특수교육보조원의 지시를 받는다. 또한 반에서 수업을 받을 때 발음이 분명하지 않아 선생님께 집중한 의사전달에 어려움이 있다. 이번 학기부터 수학시간은 특수학급에서 수업을 받는 춘수는 학업에도 어려움을 겪고 있으며, 손으로 연필을 쥐거나 낱말을 쓰는 데 어려움이 있다. 최근 들어 춘수는 수업 중 자신도 모르게 큰 소리를 내는 행동을 보인다. 특수교육보조원의 지시에 따라 모둠활동을 진행하는 과학시간에 이러한 행동이 나타난다. 그러면 아이들은 춘수를 쳐다보거나 피하고, 선생님께서는 춘수에게 "너 힘들면 특수교육보조원과 잠깐 갔다 와도 된다"고 말씀하신다.',
        },
      ],
    },
    {
      questionNumber: 1,
      questionImagePath:
        "https://capusmate.s3.amazonaws.com/exam/questions/639bc2b1177147af9303884dc193213e/q1_full.png",
      items: [
        {
          kind: "qnum",
          imagePath:
            "https://capusmate.s3.amazonaws.com/exam/items/639bc2b1177147af9303884dc193213e/q1_00_qnum.png",
          displayText: "1. 다음 문제에 대하여 해답을 서술하시오. (12점)",
        },
        {
          kind: "text",
          imagePath:
            "https://capusmate.s3.amazonaws.com/exam/items/639bc2b1177147af9303884dc193213e/q1_01_text.png",
          displayText:
            "1. 다음 문제에 대하여 해답을 서술하시오. (12점)\n(1) 강인공지능과 약한 인공지능의 차이에 대하여 서술하시오. (4점)\n(2) 지도학습과 비지도학습의 차이점에 대하여 작성하고, 각각 두 가지 이상의 예시를 작성하시오. (8점)",
        },
        {
          kind: "text",
          imagePath:
            "https://capusmate.s3.amazonaws.com/exam/items/639bc2b1177147af9303884dc193213e/q1_02_text.png",
          displayText:
            "주어진 데이터셋, \\( D = \\{(x_1,y_1), (x_2,y_2), \\ldots, (x_n,y_n)\\} \\)에 대해, 다음의 선형 관계를 가정하였다.\n\\[\ny_i = a + b x_i + e_i, \\quad i = 1, \\ldots, n\n\\]\n이 때, 오차의 제곱의 합을 최소화하는 모수 \\( a \\)와 \\( b \\)를 구하시오. (10점)\n\n선형회귀분석에서 독립변수의 수가 많아질 경우 발생할 수 있는 다중공선성 문제 및 이를 해결할 수 있는 방법 두 가지에 대하여 설명하시오. (10점)\n\nShrinkage method 중 ridge regression과 lasso regression의 목적함수를 작성하고, 추정되는 모수의 관점에서 둘의 공통점과 차이점을 서술하시오. (6점)",
        },
      ],
    },
  ],
};
