#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Odczytaj aktualną wersję
AKTUALNA=$(node -p "require('./package.json').version")

echo "Aktualna wersja: v$AKTUALNA"
echo ""
echo "Jaki typ aktualizacji?"
echo "  1) patch (np. 1.0.0 → 1.0.1) — poprawki błędów"
echo "  2) minor (np. 1.0.0 → 1.1.0) — nowe funkcje"
echo "  3) major (np. 1.0.0 → 2.0.0) — duże zmiany"
read -p "Wybierz [1/2/3]: " TYP

case $TYP in
  1) npm version patch --no-git-tag-version ;;
  2) npm version minor --no-git-tag-version ;;
  3) npm version major --no-git-tag-version ;;
  *) echo "Anulowano."; exit 1 ;;
esac

NOWA=$(node -p "require('./package.json').version")
TAG="v$NOWA"

echo ""
read -p "Opis zmian w tej wersji (opcjonalnie): " OPIS

echo ""
echo "▶ Budowanie aplikacji ($TAG)..."
npm run make

APP_DIR="out/BiznesApp-darwin-x64"
ZIP_NAME="BiznesApp-mac.zip"

if [ ! -d "$APP_DIR/BiznesApp.app" ]; then
  echo "Błąd: nie znaleziono $APP_DIR/BiznesApp.app"
  exit 1
fi

echo "▶ Pakowanie do ZIP..."
rm -f "$ZIP_NAME"
cd "$APP_DIR"
zip -r "../../$ZIP_NAME" BiznesApp.app
cd ../..

echo "▶ Commitowanie zmian wersji..."
git add package.json package-lock.json
git commit -m "chore: bump version to $TAG"

echo "▶ Tworzenie release na GitHub..."
if [ -n "$OPIS" ]; then
  gh release create "$TAG" "$ZIP_NAME" --title "$TAG" --notes "$OPIS"
else
  gh release create "$TAG" "$ZIP_NAME" --title "$TAG" --notes "Aktualizacja $TAG"
fi

echo ""
echo "✓ Release $TAG gotowy i wrzucony na GitHub!"
echo "  Tata dostanie powiadomienie przy następnym uruchomieniu aplikacji."
