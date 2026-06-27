#!/bin/bash

eapts_console="inactive"
eapts_console_stopped="stop"
eapts_console_failed="failed"

index_log_file="/var/log/emr-eApts.log"
index_error_log_file="/var/log/emr-eApt-error.log"

dtp_log_file="/var/log/emr-eApts-dtpCase.log"
dtp_error_log_file="/var/log/emr-eApt-dtpCase-error.log"

drug_log_file="/var/log/emr-eApts-drugSync.log"
drug_error_log_file="/var/log/emr-eApt-drugSync-error.log"

dispense_log_file="/var/log/emr-eApts-dispenseCase.log"
dispense_error_log_file="/var/log/emr-eApt-dispense-error.log"

address_log_file="/var/log/emr-eApts-address.log"
address_error_log_file="/var/log/emr-eApt-address-error.log"

paste_file="/root/eaptsLog/"
mkdir -p "$paste_file"
timestamp=$(date +"%Y-%m-%d_%H:%M:%S")

service AutoStartEMReAPTsListener status | while read x;
do
    if [[ "$x" = *"$eapts_console"* || "$x" = *"$eapts_console_stopped"* || "$x" = *"$eapts_console_failed"* ]]; then
        if [ -f "$index_log_file" ]; then
            mv "$index_log_file" "$paste_file/emr-eApts.log.$timestamp"
        fi
        if [ -f "$index_error_log_file" ]; then
            mv "$index_error_log_file" "$paste_file/emr-eApt-error.log.$timestamp"
        fi
        service AutoStartEMReAPTsListener start
    fi
done

service AutoStartEMReAPTsDTPListener status | while read x;
do
    if [[ "$x" = *"$eapts_console"* || "$x" = *"$eapts_console_stopped"* || "$x" = *"$eapts_console_failed"* ]]; then
        if [ -f "$dtp_log_file" ]; then
            mv "$dtp_log_file" "$paste_file/emr-eApts-dtpCase.log.$timestamp"
        fi
        if [ -f "$dtp_error_log_file" ]; then
            mv "$dtp_error_log_file" "$paste_file/emr-eApt-dtpCase-error.log.$timestamp"
        fi
        service AutoStartEMReAPTsDTPListener start
    fi
done

service AutoStartEMReAPTsDrugSyncListener status | while read x;
do
    if [[ "$x" = *"$eapts_console"* || "$x" = *"$eapts_console_stopped"* || "$x" = *"$eapts_console_failed"* ]]; then
        if [ -f "$drug_log_file" ]; then
            mv "$drug_log_file" "$paste_file/emr-eApts-drugSync.log.$timestamp"
        fi
        if [ -f "$drug_error_log_file" ]; then
            mv "$drug_error_log_file" "$paste_file/emr-eApts-drugSync-error.log.$timestamp"
        fi
        service AutoStartEMReAPTsDrugSyncListener start
    fi
done

service AutoStartEMReAPTsDispenseListener status | while read x;
do
    if [[ "$x" = *"$eapts_console"* || "$x" = *"$eapts_console_stopped"* || "$x" = *"$eapts_console_failed"* ]]; then
        if [ -f "$dispense_log_file" ]; then
            mv "$dispense_log_file" "$paste_file/emr-eApts-dispenseCase.log.$timestamp"
        fi
        if [ -f "$dispense_error_log_file" ]; then
            mv "$dispense_error_log_file" "$paste_file/emr-eApts-dispense-error.log.$timestamp"
        fi
        service AutoStartEMReAPTsDispenseListener start
    fi
done

service AutoStartEMReAPTsAddressListener status | while read x;
do
    if [[ "$x" = *"$eapts_console"* || "$x" = *"$eapts_console_stopped"* || "$x" = *"$eapts_console_failed"* ]]; then
        if [ -f "$address_log_file" ]; then
            mv "$address_log_file" "$paste_file/emr-eApts-address.log.$timestamp"
        fi
        if [ -f "$address_error_log_file" ]; then
            mv "$address_error_log_file" "$paste_file/emr-eApts-address-error.log.$timestamp"
        fi
        service AutoStartEMReAPTsAddressListener start
    fi
done
