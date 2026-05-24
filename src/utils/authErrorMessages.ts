const PASSWORD_RULE_MESSAGE =
  'A senha precisa ter pelo menos 8 caracteres, incluindo uma letra maiuscula, uma letra minuscula e um numero.';

export const isStrongPassword = (password: string) =>
  password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);

export const getPasswordRuleMessage = () => PASSWORD_RULE_MESSAGE;

export const translateAuthError = (message?: string) => {
  const normalized = (message || '').toLowerCase();

  if (!normalized) return 'Nao foi possivel concluir a acao. Tente novamente.';

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid email or password')
  ) {
    return 'E-mail ou senha incorretos. Verifique os dados e tente novamente.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Seu e-mail ainda nao foi confirmado. Verifique sua caixa de entrada antes de entrar.';
  }

  if (
    normalized.includes('password should contain') ||
    normalized.includes('weak password') ||
    normalized.includes('password requirements')
  ) {
    return PASSWORD_RULE_MESSAGE;
  }

  if (normalized.includes('password should be at least') || normalized.includes('at least 8')) {
    return PASSWORD_RULE_MESSAGE;
  }

  if (normalized.includes('already registered') || normalized.includes('user already registered')) {
    return 'Este e-mail ja esta cadastrado. Faça login ou use a recuperacao de senha.';
  }

  if (
    normalized.includes('expired') ||
    normalized.includes('invalid token') ||
    normalized.includes('otp')
  ) {
    return 'Este link expirou ou ja foi usado. Solicite um novo e-mail de recuperacao de senha.';
  }

  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.';
  }

  return message || 'Nao foi possivel concluir a acao. Tente novamente.';
};
