unpack-all:
	fvtt package workon "pf2e-pearlworld" --type "Module"
	fvtt package unpack "feats" --inputDirectory "packs" --outputDirectory "json/feats"
	fvtt package unpack "ancestries" --inputDirectory "packs" --outputDirectory "json/ancestries"
	fvtt package unpack "ancestry-features" --inputDirectory "packs" --outputDirectory "json/ancestry-features"
	fvtt package unpack "heritages" --inputDirectory "packs" --outputDirectory "json/heritages"

pack-all:
	fvtt package workon "pf2e-pearlworld" --type "Module"
	fvtt package pack "feats" --inputDirectory "json/feats" --outputDirectory "packs"
	fvtt package pack "ancestries" --inputDirectory "json/ancestries" --outputDirectory "packs"
	fvtt package pack "ancestry-features" --inputDirectory "json/ancestry-features" --outputDirectory "packs"
	fvtt package pack "heritages" --inputDirectory "json/heritages" --outputDirectory "packs"