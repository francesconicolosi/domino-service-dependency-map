# ============================================================================
#  THE RETURN OF THE SHADOW  --  SMS ROM build
#
#  Requires: sdcc (>=4.2) and the devkitSMS checkout under ../smstoolchain.
#  Override DEVKITSMS on the command line if yours lives elsewhere:
#     make DEVKITSMS=/path/to/devkitSMS
# ============================================================================
DEVKITSMS ?= ../smstoolchain/devkitSMS

CC       = sdcc
SMSLIB   = $(DEVKITSMS)/SMSlib
INCDIR   = $(SMSLIB)/src
PEEP     = $(SMSLIB)/src/peep-rules.txt
CRT0     = $(DEVKITSMS)/crt0/crt0_sms.rel
LIB      = $(SMSLIB)/SMSlib.lib
IHX2SMS  = $(DEVKITSMS)/ihx2sms/ihx2sms

PROG     = shadow
CFLAGS   = -mz80 -I$(INCDIR) --peep-file $(PEEP)
LDFLAGS  = -mz80 --no-std-crt0 --data-loc 0xC000

OBJS     = src/main.rel

all: $(PROG).sms

src/main.rel: src/main.c src/assets.h
	$(CC) $(CFLAGS) -c src/main.c -o src/main.rel

# assets.h is generated from the pixel-art pipeline
src/assets.h: tools/gen_assets.py
	python3 tools/gen_assets.py

$(PROG).ihx: $(OBJS)
	$(CC) -o $@ $(LDFLAGS) $(CRT0) $(LIB) $(OBJS)

$(PROG).sms: $(PROG).ihx
	$(IHX2SMS) $< $@

.PHONY: $(PROG).ihx all clean assets

assets:
	python3 tools/gen_assets.py

clean:
	rm -f src/*.rel src/*.ihx src/*.lst src/*.sym src/*.asm \
	      $(PROG).ihx $(PROG).sms *.map *.noi *.lk
