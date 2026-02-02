# Doctrine Entity Patterns

Best practices for Doctrine ORM 3 entities in modern PHP projects.

---

## Philosophy

- **Database enforces integrity**: Constraints live in the schema, not just application code
- **Entities are domain objects**: Rich behavior, not just data bags
- **Data Mapper pattern**: Entities are independent of persistence layer
- **Type-safe by default**: Typed properties, backed enums, value objects

---

## Base Entity

### Timestamp Trait

```php
// src/Entity/Trait/HasTimestamps.php
<?php

declare(strict_types=1);

namespace App\Entity\Trait;

use Doctrine\ORM\Mapping as ORM;

trait HasTimestamps
{
    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $createdAt;

    #[ORM\Column(type: 'datetime_immutable')]
    private \DateTimeImmutable $updatedAt;

    #[ORM\PrePersist]
    public function setCreatedAtValue(): void
    {
        $this->createdAt = new \DateTimeImmutable();
        $this->updatedAt = new \DateTimeImmutable();
    }

    #[ORM\PreUpdate]
    public function setUpdatedAtValue(): void
    {
        $this->updatedAt = new \DateTimeImmutable();
    }

    public function getCreatedAt(): \DateTimeImmutable
    {
        return $this->createdAt;
    }

    public function getUpdatedAt(): \DateTimeImmutable
    {
        return $this->updatedAt;
    }
}
```

**Usage**: Every entity gets timestamps. No exceptions.

---

## Entity Definition (Doctrine 3 + Attributes)

### Complete Example

```php
// src/Entity/User.php
<?php

declare(strict_types=1);

namespace App\Entity;

use App\Entity\Trait\HasTimestamps;
use App\Enum\UserRole;
use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

#[ORM\Entity(repositoryClass: UserRepository::class)]
#[ORM\Table(name: 'users')]
#[ORM\HasLifecycleCallbacks]
#[ORM\UniqueConstraint(name: 'uq_users_email', columns: ['email'])]
class User
{
    use HasTimestamps;

    #[ORM\Id]
    #[ORM\GeneratedValue]
    #[ORM\Column]
    private ?int $id = null;

    #[ORM\Column(length: 255, unique: true)]
    private string $email;

    #[ORM\Column(length: 255)]
    private string $name;

    #[ORM\Column(length: 255)]
    private string $hashedPassword;

    #[ORM\Column(type: 'text', nullable: true)]
    private ?string $bio = null;

    #[ORM\Column]
    private bool $isActive = true;

    #[ORM\Column(length: 20, enumType: UserRole::class)]
    private UserRole $role = UserRole::Member;

    /** @var Collection<int, Post> */
    #[ORM\OneToMany(targetEntity: Post::class, mappedBy: 'author', cascade: ['persist', 'remove'])]
    private Collection $posts;

    public function __construct(string $email, string $name, string $hashedPassword)
    {
        $this->email = $email;
        $this->name = $name;
        $this->hashedPassword = $hashedPassword;
        $this->posts = new ArrayCollection();
    }

    public function getId(): ?int { return $this->id; }
    public function getEmail(): string { return $this->email; }
    public function getName(): string { return $this->name; }
    public function getRole(): UserRole { return $this->role; }
    public function isActive(): bool { return $this->isActive; }

    public function changeRole(UserRole $role): void
    {
        $this->role = $role;
    }

    public function deactivate(): void
    {
        $this->isActive = false;
    }
}
```

### Key Conventions

| Convention | Example | Reason |
|---|---|---|
| Singular entity name | `User`, not `Users` | PHP class convention |
| Plural table name | `users` | SQL convention |
| Private properties + getters | `private string $email` | Encapsulation |
| Constructor for required fields | `__construct(email, name, ...)` | Entity is always valid |
| Backed enums for status fields | `UserRole::Member` | Type safety, no magic strings |
| `DateTimeImmutable` over `DateTime` | `$createdAt` | Prevent mutation bugs |

---

## Relationships

### One-to-Many

```php
// Post belongs to User
#[ORM\ManyToOne(targetEntity: User::class, inversedBy: 'posts')]
#[ORM\JoinColumn(nullable: false)]
private User $author;

// User has many Posts
/** @var Collection<int, Post> */
#[ORM\OneToMany(targetEntity: Post::class, mappedBy: 'author', cascade: ['persist', 'remove'])]
private Collection $posts;
```

### Many-to-Many

```php
/** @var Collection<int, Tag> */
#[ORM\ManyToMany(targetEntity: Tag::class)]
#[ORM\JoinTable(name: 'post_tags')]
private Collection $tags;

public function addTag(Tag $tag): void
{
    if (!$this->tags->contains($tag)) {
        $this->tags->add($tag);
    }
}

public function removeTag(Tag $tag): void
{
    $this->tags->removeElement($tag);
}
```

### Loading Strategy

**Rule**: Never configure eager loading on the entity. Use DQL or QueryBuilder:

```php
// In repository: choose loading strategy per query
$qb = $this->createQueryBuilder('p')
    ->addSelect('a')                    // JOIN fetch author
    ->leftJoin('p.author', 'a')
    ->where('p.status = :status')
    ->setParameter('status', 'published');
```

---

## Soft Deletes

### Trait Pattern

```php
trait SoftDeletable
{
    #[ORM\Column(type: 'datetime_immutable', nullable: true)]
    private ?\DateTimeImmutable $deletedAt = null;

    public function isDeleted(): bool
    {
        return $this->deletedAt !== null;
    }

    public function softDelete(): void
    {
        $this->deletedAt = new \DateTimeImmutable();
    }

    public function restore(): void
    {
        $this->deletedAt = null;
    }
}
```

---

## Repository Pattern

```php
// src/Repository/UserRepository.php
<?php

declare(strict_types=1);

namespace App\Repository;

use App\Entity\User;
use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;

final class UserRepository implements UserRepositoryInterface
{
    /** @var EntityRepository<User> */
    private EntityRepository $repo;

    public function __construct(
        private readonly EntityManagerInterface $em,
    ) {
        $this->repo = $em->getRepository(User::class);
    }

    public function find(int $id): ?User
    {
        return $this->repo->find($id);
    }

    public function findByEmail(string $email): ?User
    {
        return $this->repo->findOneBy(['email' => $email]);
    }

    public function save(User $user): void
    {
        $this->em->persist($user);
        $this->em->flush();
    }
}
```

---

## Anti-Patterns

| Anti-Pattern | Problem | Correct Approach |
|---|---|---|
| Public properties on entities | No encapsulation, bypass validation | Private properties + methods |
| Setters for everything | Entity state can become invalid | Named behavior methods (`deactivate()`, `changeRole()`) |
| EntityManager in entities | Couples entity to persistence | Repository + service layer |
| Array return types from repos | No type safety | Return typed entities or collections |
| `DateTime` over `DateTimeImmutable` | Mutation bugs via reference | Always use `DateTimeImmutable` |
| Business logic in repositories | Repositories become god classes | Service layer for business rules |

---

_Entities define structure and behavior. Persistence logic belongs in repositories. Orchestration belongs in services._
