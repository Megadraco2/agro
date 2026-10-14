import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Schema de autenticação', () => {
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = module.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.sessaoUsuario.deleteMany();
    await prisma.usuario.deleteMany();
    await prisma.sessaoAdminSistema.deleteMany();
    await prisma.adminSistema.deleteMany();
  });

  it('Organizacao tem maxUsuarios com default 5', async () => {
    const organizacao = await prisma.organizacao.create({
      data: { slug: `teste-${Date.now()}`, nome: 'Org de teste' },
    });
    expect(organizacao.maxUsuarios).toBe(5);
  });

  it('rejects two AdminSistema with the same email', async () => {
    await prisma.adminSistema.create({
      data: { email: 'admin@teste.com', senhaHash: 'hash' },
    });
    await expect(
      prisma.adminSistema.create({
        data: { email: 'admin@teste.com', senhaHash: 'outro-hash' },
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
