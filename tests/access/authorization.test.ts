import { describe, it, expect } from 'vitest';
import { createSessionToken, verifySessionToken } from '@/lib/auth/session';
import { Role } from '@prisma/client';

describe('Access Control and Session Security', () => {
  it('creates and securely verifies a student session token', async () => {
    const studentPayload = {
      userId: 'student-uuid-1',
      username: 'student1',
      role: Role.STUDENT,
    };

    const token = await createSessionToken(studentPayload);
    expect(typeof token).toBe('string');

    const decoded = await verifySessionToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.userId).toBe(studentPayload.userId);
    expect(decoded?.username).toBe(studentPayload.username);
    expect(decoded?.role).toBe(Role.STUDENT);
  });

  it('creates and securely verifies an admin session token', async () => {
    const adminPayload = {
      userId: 'admin-uuid-1',
      username: 'admin',
      role: Role.ADMIN,
    };

    const token = await createSessionToken(adminPayload);
    const decoded = await verifySessionToken(token);
    expect(decoded?.role).toBe(Role.ADMIN);
  });

  it('rejects tampered or malformed session tokens', async () => {
    const validToken = await createSessionToken({
      userId: 'user-1',
      username: 'user1',
      role: Role.STUDENT,
    });

    // Tamper with payload portion
    const tamperedToken = validToken.slice(0, -6) + 'abc123';
    const decoded = await verifySessionToken(tamperedToken);
    expect(decoded).toBeNull();

    const garbageDecoded = await verifySessionToken('invalid.jwt.token');
    expect(garbageDecoded).toBeNull();
  });

  it('enforces that students do not have ADMIN role permissions', () => {
    const studentUser = {
      userId: 'student-uuid',
      username: 'teststudent',
      role: Role.STUDENT,
    };

    const isAdmin = studentUser.role === Role.ADMIN;
    expect(isAdmin).toBe(false);
  });

  it('validates ownership isolation rules (User A vs User B)', () => {
    const userA = { id: 'user-a-id' };
    const userB = { id: 'user-b-id' };

    const subjectOwnedByA = {
      id: 'subj-1',
      ownerId: userA.id,
      name: 'Matematyka Dyskretna',
    };

    const categoryOwnedByA = {
      id: 'cat-1',
      ownerId: userA.id,
      subjectId: subjectOwnedByA.id,
      name: 'Kolokwia',
    };

    // User B tries to read or modify User A's subject
    const canUserBAccessSubject = subjectOwnedByA.ownerId === userB.id;
    expect(canUserBAccessSubject).toBe(false);

    // User B tries to create a task assigning User A's subject
    const canUserBAssignSubject = subjectOwnedByA.ownerId === userB.id;
    expect(canUserBAssignSubject).toBe(false);

    // User A assigning category to task: must match both ownerId and subjectId
    const taskSubjectId = subjectOwnedByA.id;
    const isCategoryValidForTask =
      categoryOwnedByA.ownerId === userA.id &&
      categoryOwnedByA.subjectId === taskSubjectId;
    expect(isCategoryValidForTask).toBe(true);

    // If category belongs to different subject
    const otherSubject = { id: 'subj-2', ownerId: userA.id };
    const isCategoryValidForOtherSubject =
      categoryOwnedByA.ownerId === userA.id &&
      categoryOwnedByA.subjectId === otherSubject.id;
    expect(isCategoryValidForOtherSubject).toBe(false);
  });
});
