# Character Chronicle Monorepo

This is an Nx workspace containing the Character Chronicle application.

## Structure

- `apps/character-chronicle`: The main Next.js application.
- `libs/`: Potential location for shared libraries (e.g., UI components, core logic).

## Development

To start the development server for the Next.js app:

```bash
nx serve character-chronicle
```

## Build

To build the application for production:

```bash
nx build character-chronicle
```

## Linting

To lint the application:

```bash
nx lint character-chronicle
```

## Genkit

To start the Genkit development flow:

```bash
nx run character-chronicle:genkit:dev
```

To start Genkit with watch mode:

```bash
nx run character-chronicle:genkit:watch
```

## Further Help

Visit the [Nx documentation](https://nx.dev) to learn more.
