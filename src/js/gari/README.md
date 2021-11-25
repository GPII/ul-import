# GARI import script.

This directory contains a script that is used to pull data from [GARI](http://www.mobileaccessibility.info/).  GARI is a database that includes information about mobile devices and what (if any) features they have that are relevant to Assistive Technology users.

They also have data about AT mobile apps (which is not currently available for download or processing).


# The data and conversion process

We will convert from their format to the standard format used in the Unified Listing.  To do this, we must first understand the structure of the data exported from GARI.

## GARI's data format

GARI provides [an RSS feed](http://mobileaccessibility.info/xml/mobile-accessibility-phones.xml) that represents their current device data.

### Overall Structure

The main structure of their feed is roughly:

```
 <rss>
   <channel>
     <description>...</description>
     <FeatureCategories>
       <FeatureSet>
         <Category>HARDWARE INFORMATION</Category>
         <FeatureSpec>
           <FeatureTitle>Handset weight</FeatureTitle>
           <SpecType>OneNumValUnit</SpecType>
           <Unit>Grams</Unit>
         </FeatureSpec>
         <FeatureSpec>...</FeatureSpec>
       </FeatureSet>
       <FeatureSet>...</FeatureSet>
     </FeatureCategories>

     <product> ... See Below ... </product>
     <product> ... See Below ... </product>
   </channel>
 </rss>
```

The `FeatureCategories` data will largely be ignored for now, but it does represent a dictionary of the features GARI tracks.  This information corresponds to the `<item>` elements in a given [product](#product-record-structure).  It may be useful later on in providing updates to GARI or comparing the GARI ontology to that used by EASTIN.

## Product record structure

In the RSS feed, individual product records look like:

```
<product>
    <objectid>1808</objectid>
    <productpic>http:gari.info/goget.cfm?picfile=17131D0D1101134C1B0D555A57595F1F554C0D1115</productpic>
    <Manufacturer-Importer>Samsung</Manufacturer-Importer>
    <ProductBrand>Samsung</ProductBrand>
    <Model>SGH-I317 (Galaxy Note2)</Model>
    <Platform>Android</Platform>
    <PlatformVersion>KiKat 4.4</PlatformVersion>
    <Countries>United States</Countries>
    <Regions>North America</Regions>
    <Website>http:www.samsung.com/us</Website>
    <DateCompleted>Oct-30-2014</DateCompleted>
    <item>
    <Feature>Handset weight</Feature>
    <Description>Weight including battery.</Description>
    <Detail>178.6 Grams</Detail>
    </item>
    <item>... may be repeated ...</item>
</product>
```

# The Unified Listing Data structure

The raw GARI data must be transformed into the format described in the [Unified Listing API documentation](https://github.com/the-t-in-rtf/unified-listing/blob/master/front-end/api/docs/ul.md).

# Converting from GARI to the Unified Listing format

## Core mapping
The following table describes how the existing XML maps to the core JSON structure of a Unified Listing record.  XML elements are referenced using XPATH notation relative to the `product` element.  JSON elements are referenced using dot notation relative to a JSON object called product.  Static values are enclosed in quotation marks.

| UL data | GARI data |
| ------- | --------- |
| `product.source`  | "gari" |
| `product.sid` | `product/objectId` |
| `product.name` | `product/model` |
| `product.description` | "" |
| `product.manufacturer.name` | `product/productbrand` |
| `product.manufacturer.url` | `product/website` |
| `product.manufacturer.country` | `product/countries` |
| `product.language` | "en_us" |
| `product.updated` | `product/datecompleted` |
| `product.ontologies.context.id` | `product/platform` |
| `product.ontologies.context.version` | `product/platformversion` |

Please note, the value of the GARI `datecompleted` element is converted to [the ISO standard date format](http://en.wikipedia.org/wiki/ISO_8601) before it is stored.

Note also that GARI does not provide any kind of description in their dataset.  This field is ordinarily not allowed to be empty.  As a final note, all of their data is only available in English.

## Ontologies data

All features (`item` elements) in the original data are converted to JSON and stored in the record's `ontologies` field under a `gari` entry.

GARI records also include information about the operating system available on the device.  This information is referred to as a `context` in the [Solutions Registry](http://wiki.gpii.net/w/Solution_Registry), and we extract the OS information for that purpose.

The combined data for the above example would look something like:

```
{
  ...
  ontologies: {
    gari: {
      features: {
        "Handset weight": {
          description: "Weight including battery.",
          detail: "178.6 Grams"
        }
      }
    },
    contexts: {
      "OS": [
        {
          "id": "android",
          "version": "KiKat 4.4"
        }
      ]
    }
  }
  ...
}
```

## Original Data

The original record format is converted to JSON data without any other changes and stored in the `sourceData` field.

## Sample Record

A final JSON representation of the sample record above should result in JSON data like:

```
{
  source: "gari",
  sid: "1808",
  name: "SGH-I317 (Galaxy Note2)",
  description: "",
  manufacturer: {
    name:    "Samsung",
    url:     "http:www.samsung.com/us",
    country: "United States"
  },
  ontologies: {
    gari: {
      features: {
        "Handset weight": {
          description: "Weight including battery.",
          detail: "178.6 Grams"
        }
      }
    },
    contexts: {
      "OS": [
        {
          "id": "android",
          "version": "KiKat 4.4"
        }
      ]
    }
  },
  sourceUrl: "https://www.gari.info/findphones-detail.cfm?productid=1808",
  sourceRecord: {
   // omitted for brevity
  },
  updated: "2014-10-30"
}
```