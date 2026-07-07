# Backup and Restore Guide

This guide explains how to use the workspace backup and restore scripts for the QORTIUM workspace.

## Location

- Backups are stored in `/home/iffiolen/VS-Code-Projects/_workspace_backups/QORTIUM`
- Backup filenames follow `qortium-iffi-vaba-mees-YYYY-MM-DD_HH-MM-SS.tar.gz`
- The restore script also recognizes older `discussion-boards-workspace-*.tar.gz` archives for compatibility

## Create a backup

Run from the project root:

```bash
npm run backup:workspace
```

This command:

- creates a `.tar.gz` backup of the workspace
- stores it in the QORTIUM backup directory
- adds a timestamp to the filename
- keeps the newest backups automatically
- removes older backups automatically
- uses `BACKUP_RETENTION` if you want to change the default retention (default: 3)

## Restore from a backup

Run from the project root:

```bash
npm run restore:workspace
```

You can also restore non-interactively by passing the backup number:

```bash
npm run restore:workspace -- 1
```

Restore flow:

- the script shows a numbered list of available backups
- you choose the backup by number
- you confirm the action by typing `RESTORE`

## Important warning

Restore replaces workspace files with the selected backup contents.

- the script keeps the `.git` directory
- all other workspace files are replaced by the selected backup

## Run the scripts directly

If needed, you can also run:

```bash
bash scripts/backup-workspace.sh
bash scripts/restore-workspace.sh
```
