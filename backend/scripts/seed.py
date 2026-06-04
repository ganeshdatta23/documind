"""
Bootstrap a local workspace: one tenant and one superadmin you can log in with.

There's no public sign-up endpoint (this is a B2B app), so this script is how
you create the very first account on a fresh database. It's safe to re-run —
existing rows are left untouched.

    cd backend && poetry run python -m scripts.seed

Override the defaults with env vars: SEED_EMAIL, SEED_PASSWORD, SEED_TENANT.
"""
from __future__ import annotations

import asyncio
import os

from sqlalchemy import select

from database import async_session_factory
from models import Role, Tenant, User, user_roles_table
from security import hash_password


async def seed() -> None:
    # Use a real-looking domain: email-validator rejects reserved TLDs like
    # `.local`, and the login schema (EmailStr) enforces that on the way back in.
    email = os.getenv("SEED_EMAIL", "admin@documind.io")
    password = os.getenv("SEED_PASSWORD", "Admin123!")
    tenant_slug = os.getenv("SEED_TENANT", "demo")

    async with async_session_factory() as db:
        # Reuse the tenant if it already exists, otherwise create it.
        tenant = (
            await db.execute(select(Tenant).where(Tenant.slug == tenant_slug))
        ).scalar_one_or_none()
        if tenant is None:
            tenant = Tenant(
                name="Demo Workspace",
                slug=tenant_slug,
                plan="enterprise",
                max_documents=10_000,
                max_users=100,
            )
            db.add(tenant)
            await db.flush()
            print(f"Created tenant '{tenant_slug}' ({tenant.id})")
        else:
            print(f"Tenant '{tenant_slug}' already exists ({tenant.id})")

        # Don't recreate the user if the email is already taken in this tenant.
        existing = (
            await db.execute(
                select(User).where(User.tenant_id == tenant.id, User.email == email)
            )
        ).scalar_one_or_none()
        if existing:
            print(f"User '{email}' already exists — nothing to do.")
            await db.commit()
            return

        user = User(
            tenant_id=tenant.id,
            email=email,
            hashed_password=hash_password(password),
            full_name="DocuMind Admin",
            is_active=True,
            is_superadmin=True,
            email_verified=True,
        )
        db.add(user)
        await db.flush()

        # Grant the org_admin role if it was seeded by the migration/schema.
        # Insert the association row directly — appending to user.roles would
        # lazy-load the collection, which isn't allowed in an async session.
        org_admin = (
            await db.execute(select(Role).where(Role.name == "org_admin"))
        ).scalar_one_or_none()
        if org_admin:
            await db.execute(
                user_roles_table.insert().values(user_id=user.id, role_id=org_admin.id)
            )

        await db.commit()
        print(f"Created superadmin '{email}' (password: {password})")
        print("Log in at http://localhost:3000/login")


if __name__ == "__main__":
    asyncio.run(seed())
