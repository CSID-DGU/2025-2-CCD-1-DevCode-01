import { patchNoResponse } from "@apis/instance";

export type AccessibilityPatchRequest = {
  font: string;
  high_contrast: boolean;
};

export async function patchAccessibility(
  body: AccessibilityPatchRequest
): Promise<boolean> {
  return patchNoResponse<AccessibilityPatchRequest>(
    "/auth/accessibility/",
    body
  );
}
