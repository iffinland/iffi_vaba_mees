#!/bin/bash

# --- KONFIGURATSIOON ---
# Määrame projekti kausta (skript eeldab, et see käivitatakse projekti kaustast)
PROJECT_DIR=$(pwd)

# Määrame, kuhu varukoopiad salvestatakse (ntx sinu kodukataloogi alla)
BACKUP_DIR="$HOME/project_backups/iffi-vaba-mees"

# Mitu viimast varukoopiat alles hoida
KEEP_LAST=3
# --- KONFIGURATSIOONI LÕPP ---


# Loo varukoopiate kaust, kui seda pole
mkdir -p "$BACKUP_DIR"

# Loo ajatempliga arhiivi nimi
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
ARCHIVE_NAME="backup-$TIMESTAMP.tar.gz"

echo "Loome varukoopiat: $ARCHIVE_NAME"

# Loo arhiiv. Välistame node_modules ja .git kaustad, et hoida maht väike.
# -C lipu abil määrame, et arhiveerimine toimuks projekti juurkaustas.
tar --exclude='node_modules' --exclude='.git' -czf "$BACKUP_DIR/$ARCHIVE_NAME" -C "$(dirname "$PROJECT_DIR")" "$(basename "$PROJECT_DIR")"

echo "Varukoopia edukalt loodud asukohta $BACKUP_DIR"

# Kustuta vanad varukoopiad
echo "Puhastame vanad varukoopiad..."
# ls -1t sorteerib failid aja järgi, uuemad eespool
# tail -n +X jätab vahele X esimest rida
ls -1t "$BACKUP_DIR" | tail -n +$(($KEEP_LAST + 1)) | while read -r old_backup; do
  echo "Kustutan vana koopia: $old_backup"
  rm -- "$BACKUP_DIR/$old_backup"
done

echo "Puhastus lõpetatud. Alles jäi $KEEP_LAST viimast koopiat."
