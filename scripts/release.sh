#!/bin/bash
set -e

cd "$(dirname "$0")/.."

# Sprawdź najnowszy release na GitHub
echo "▶ Sprawdzam wersje..."
GITHUB_TAG=$(gh release list --repo BrainMaster24608/biznes-app --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null || echo "")
GITHUB_VER="${GITHUB_TAG#v}"
LOCAL_VER=$(node -p "require('./package.json').version")

# Jeśli package.json jest za GitHubem — zsynchronizuj
if [ -n "$GITHUB_VER" ] && [ "$GITHUB_VER" != "$LOCAL_VER" ]; then
  echo "  package.json: v$LOCAL_VER"
  echo "  GitHub:       v$GITHUB_VER"
  echo "  → Synchronizuję package.json do v$GITHUB_VER"
  npm version "$GITHUB_VER" --no-git-tag-version --allow-same-version > /dev/null
  LOCAL_VER="$GITHUB_VER"
fi

echo ""
echo "Aktualna wersja: v$LOCAL_VER"
echo ""
echo "Jaki typ aktualizacji?"
echo "  1) patch — poprawki błędów"
echo "  2) minor — nowe funkcje"
echo "  3) major — duże zmiany"
read -p "Wybierz [1/2/3]: " TYP

case $TYP in
  1) npm version patch --no-git-tag-version > /dev/null ;;
  2) npm version minor --no-git-tag-version > /dev/null ;;
  3) npm version major --no-git-tag-version > /dev/null ;;
  *) echo "Anulowano."; exit 1 ;;
esac

NOWA=$(node -p "require('./package.json').version")
TAG="v$NOWA"

echo "Nowa wersja: $TAG"
echo ""
read -p "Opis zmian (opcjonalnie): " OPIS

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
zip -r "../../$ZIP_NAME" BiznesApp.app -q
cd ../..

echo "▶ Commitowanie i pushowanie zmian wersji..."
git add package.json package-lock.json
git commit -m "chore: bump version to $TAG"
git push

echo "▶ Tworzenie release na GitHub..."
gh release create "$TAG" "$ZIP_NAME" \
  --title "$TAG" \
  --notes "${OPIS:-Aktualizacja $TAG}"

rm -f "$ZIP_NAME"

echo ""
echo "✓ Release $TAG gotowy!"
echo "  Aplikacja taty zaktualizuje się automatycznie przy następnym uruchomieniu."
