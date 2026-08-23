import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

const ARGON_OPTIONS: argon2.HashOptions & { raw: false } = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
  raw: false,
};

@Injectable()
export class PasswordHasher {
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON_OPTIONS);
  }

  verify(hash: string, password: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  async verifyUnknownPassword(password: string): Promise<void> {
    this.dummyHash ??= this.hash('money-tracker-dummy-password');
    await this.verify(await this.dummyHash, password);
  }
}
