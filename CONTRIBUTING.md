# Contributing to Helix

Thank you for your interest in contributing to Helix! We welcome contributions from the community and are grateful for your support.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Coding Standards](#coding-standards)
- [Pull Request Process](#pull-request-process)
- [Reporting Bugs](#reporting-bugs)
- [Suggesting Features](#suggesting-features)
- [Development Workflow](#development-workflow)

## 📜 Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

### Our Standards

- **Be Respectful**: Treat everyone with respect and kindness
- **Be Collaborative**: Work together and help each other
- **Be Professional**: Keep discussions focused and constructive
- **Be Inclusive**: Welcome contributors of all backgrounds and experience levels

## 🚀 Getting Started

1. Fork the repository on GitHub
2. Clone your fork locally
3. Set up the development environment
4. Create a branch for your changes
5. Make your changes
6. Push to your fork and submit a pull request

## 💻 Development Setup

### Prerequisites

- Docker & Docker Compose
- Node.js 18+ (for frontend development without Docker)
- Python 3.11+ (for backend development without Docker)
- Git

### Initial Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/Helix.git
cd Helix

# Add upstream remote
git remote add upstream https://github.com/divagr18/Helix.git

# Create .env file
cp .env.example .env
# Edit .env with your values

# Start services
docker-compose up -d
```

### Frontend Development

```bash
cd frontend
npm install
npm run dev
```

### Backend Development

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

## 🤝 How to Contribute

### Types of Contributions

We welcome many types of contributions:

- **Bug fixes**
- **New features**
- **Documentation improvements**
- **Code refactoring**
- **Tests**
- **UI/UX improvements**
- **Performance optimizations**
- **Security enhancements**

### Finding Something to Work On

1. Check the [Issues](https://github.com/divagr18/Helix/issues) page
2. Look for issues labeled `good first issue` or `help wanted`
3. Comment on an issue to let others know you're working on it
4. Ask questions if you need clarification

## 📝 Coding Standards

### Python (Backend)

- Follow **PEP 8** style guide
- Use **type hints** where appropriate
- Write **docstrings** for functions and classes
- Keep functions small and focused
- Use **meaningful variable names**

```python
def calculate_complexity(code: str) -> int:
    """
    Calculate the cyclomatic complexity of given code.
    
    Args:
        code: Source code string to analyze
        
    Returns:
        Integer representing cyclomatic complexity
    """
    # Implementation
    pass
```

**Linting:**
```bash
cd backend
ruff check .
ruff format .
```

### TypeScript/React (Frontend)

- Follow **TypeScript** best practices
- Use **functional components** and hooks
- Keep components **small and reusable**
- Use **meaningful prop names**
- Write **JSDoc comments** for complex functions

```typescript
interface ButtonProps {
    onClick: () => void;
    disabled?: boolean;
    children: React.ReactNode;
}

/**
 * Primary button component with consistent styling
 */
export const Button: React.FC<ButtonProps> = ({ onClick, disabled, children }) => {
    // Implementation
};
```

**Linting:**
```bash
cd frontend
npm run lint
npm run format
```

### General Guidelines

- Write **clear commit messages**
- Add **tests** for new features
- Update **documentation** when needed
- Keep **PRs focused** on a single change
- **Rebase** instead of merge when updating your branch

## 🔄 Pull Request Process

### Before Submitting

1. ✅ Ensure your code follows our coding standards
2. ✅ Add or update tests as needed
3. ✅ Update documentation if you changed functionality
4. ✅ Run linters and fix any issues
5. ✅ Test your changes thoroughly
6. ✅ Rebase on latest `main` branch

### PR Template

When creating a PR, please include:

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## How Has This Been Tested?
Describe the tests you ran

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code where needed
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing tests pass locally
```

### Review Process

1. Maintainers will review your PR within 1-3 business days
2. Address any feedback or requested changes
3. Once approved, a maintainer will merge your PR
4. Your contribution will be included in the next release!

## 🐛 Reporting Bugs

### Before Submitting a Bug Report

- Check if the bug has already been reported
- Collect information about the bug:
  - Stack trace
  - OS and browser/version
  - Steps to reproduce
  - Expected vs actual behavior

### Bug Report Template

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g. Windows 11, macOS 14]
- Browser: [e.g. Chrome 120, Firefox 121]
- Version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem.
```

## 💡 Suggesting Features

We love feature suggestions! Please:

1. **Check** if the feature has already been suggested
2. **Describe** the feature clearly
3. **Explain** why it would be useful
4. **Provide** examples if possible

### Feature Request Template

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
What you want to happen.

**Describe alternatives you've considered**
Other solutions you've thought about.

**Additional context**
Any other context or screenshots.
```

## 🔧 Development Workflow

### Branch Naming

- `feature/` - New features
- `bugfix/` - Bug fixes
- `hotfix/` - Urgent fixes
- `docs/` - Documentation changes
- `refactor/` - Code refactoring
- `test/` - Test additions or changes

**Example:** `feature/add-code-search` or `bugfix/fix-upload-limit`

### Commit Messages

Follow conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting changes
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(upload): add support for drag-and-drop file upload

- Added drag-and-drop zone to upload page
- Updated file validation logic
- Added visual feedback for dragging

Closes #123
```

```
fix(auth): resolve GitHub OAuth redirect issue

Fixed incorrect callback URL causing authentication failures

Fixes #456
```

### Testing

**Backend Tests:**
```bash
cd backend
python manage.py test
```

**Frontend Tests:**
```bash
cd frontend
npm run test
```

**Coverage Reports:**
```bash
cd backend
coverage run --source='.' manage.py test
coverage report
```

### Code Review Guidelines

When reviewing PRs:

- ✅ Be constructive and respectful
- ✅ Explain reasoning for suggestions
- ✅ Approve when ready, request changes when needed
- ✅ Focus on code quality, not personal preferences
- ✅ Test the changes locally if possible

## 📚 Additional Resources

- [Django Documentation](https://docs.djangoproject.com/)
- [React Documentation](https://react.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Docker Documentation](https://docs.docker.com/)
- [Git Best Practices](https://git-scm.com/book/en/v2)

## 🙏 Thank You!

Your contributions make Helix better for everyone. We appreciate your time and effort!

---

**Questions?** Feel free to ask in:
- [GitHub Discussions](https://github.com/divagr18/Helix/discussions)
- [GitHub Issues](https://github.com/divagr18/Helix/issues)

**Happy Coding! 🚀**
