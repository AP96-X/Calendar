/**
 * 密码复杂度校验（与后端 backend/auth.py 的 validate_password_strength 保持一致）
 * 规则：长度 ≥ 8；大写/小写/数字/特殊字符至少 3 类。
 * 返回错误信息字符串，校验通过返回空字符串。
 */
export function passwordStrengthError(value: string): string {
  if (!value || value.length < 8) return '密码至少 8 位';
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(value)).length;
  if (kinds < 3) return '需包含大写字母、小写字母、数字、特殊字符中的至少 3 类';
  return '';
}

/** antd Form rule 用：校验通过返回 Promise.resolve()，否则 reject */
export function passwordValidator(_: unknown, value: string) {
  const err = passwordStrengthError(value || '');
  return err ? Promise.reject(new Error(err)) : Promise.resolve();
}
