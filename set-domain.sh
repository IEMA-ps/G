#!/bin/sh
# الاستخدام:  sh set-domain.sh alababak.com
[ -z "$1" ] && { echo "اكتب الدومين: sh set-domain.sh alababak.com"; exit 1; }
sed -i "s/YOUR-DOMAIN/$1/g" index.html robots.txt sitemap.xml && echo "تم ضبط الدومين: $1"
