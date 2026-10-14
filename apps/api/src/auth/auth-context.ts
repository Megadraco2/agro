export interface AuthContext {
  usuarioId: string;
  organizacaoId: string;
  papel: 'ORG_ADMIN' | 'ORG_MEMBER';
}

declare module 'express' {
  interface Request {
    auth?: AuthContext;
  }
}
