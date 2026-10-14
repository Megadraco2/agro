import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const EMAIL_ADMIN_DE_TESTE = 'admin@teste.com';

describe('Schema de autenticação', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.sessaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.sessaoAdminSistema.deleteMany();
    // Não apaga todos os AdminSistema: o admin bootstrapado no init do app
    // precisa continuar existindo pra qualquer teste que dependa dele. Só
    // remove o admin que o teste de email duplicado abaixo cria.
    await prisma.adminSistema.deleteMany({
      where: { email: EMAIL_ADMIN_DE_TESTE },
    });
  });

  it('Organizacao tem maxUsuarios com default 5', async () => {
    const organizacao = await prisma.organizacao.create({
      data: { slug: `teste-${Date.now()}`, nome: 'Org de teste' },
    });
    expect(organizacao.maxUsuarios).toBe(5);
  });

  it('rejects two AdminSistema with the same email', async () => {
    await prisma.adminSistema.create({
      data: { email: EMAIL_ADMIN_DE_TESTE, senhaHash: 'hash' },
    });
    await expect(
      prisma.adminSistema.create({
        data: { email: EMAIL_ADMIN_DE_TESTE, senhaHash: 'outro-hash' },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('rejects two Usuario with the same email', async () => {
    const organizacao = await prisma.organizacao.create({
      data: { slug: `teste-${Date.now()}`, nome: 'Org de teste' },
    });
    await prisma.usuario.create({
      data: {
        organizacaoId: organizacao.id,
        email: 'usuario@teste.com',
        senhaHash: 'hash',
        papel: 'ORG_ADMIN',
      },
    });
    await expect(
      prisma.usuario.create({
        data: {
          organizacaoId: organizacao.id,
          email: 'usuario@teste.com',
          senhaHash: 'outro-hash',
          papel: 'ORG_MEMBER',
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
});
