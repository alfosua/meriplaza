# Venezuela Fiscal Invoice API Data Structure

This document describes the data structure needed for an API that can produce
Venezuelan fiscal invoices similar to the photographed receipt. The example is a
machine-fiscal retail invoice issued in Venezuela, with SENIAT identification,
issuer data, customer data, fiscal invoice number, date/time, line items, VAT,
payment breakdown, exchange-rate disclosure, barcode, fiscal printer register,
and footer text.

This is an engineering specification, not legal advice. Final compliance should
be validated with a Venezuelan tax specialist, the fiscal-printer vendor, and
the current SENIAT authorization applicable to the issuer and emission channel.

## Regulatory Context

Relevant public references used for this model:

- SENIAT Providencia Administrativa `SNAT/2011/0071`, commonly cited for invoice
  and fiscal-machine requirements.
- SENIAT digital-invoicing framework `SNAT/2024/000102`, published in Gaceta
  Oficial No. 43.032 on 2024-12-19, for authorized digital issuance scenarios.
- Secondary summaries from EDICOM, Acceso a la Justicia, Baker Tilly Venezuela,
  and Venezuelan tax-consulting publications were used to cross-check current
  digital invoicing terminology.

For machine-fiscal invoices like the receipt, the payload should preserve both
business data and printer/fiscal-control data. Some final fields may be generated
by the fiscal printer or authorized emission provider and should not be accepted
from untrusted clients.

## Receipt Anatomy

Observed data from the provided receipt:

| Area | Observed value | API field |
| --- | --- | --- |
| Tax authority marker | `SENIAT` | `fiscalAuthority.name` |
| Issuer RIF | `J-095124614` | `issuer.identifier` |
| Issuer name | `CENTRAL SANTO TOME III, C.A` | `issuer.company.razonSocial` |
| Issuer address | multi-line retail address | `issuer.address` |
| Issuer phone | `0286-9619023`, `9624663` | `issuer.contacts` |
| Document title | `FACTURA` | `document.type` |
| Invoice number | `000046998` | `document.number` |
| Issue date | `11-06-2026` | `document.issuedAt` |
| Issue time | `17:42` | derived from `document.issuedAt` |
| Customer tax ID | `V28476588` | `customer.identifier` |
| Customer name | `ALFONZO SUAREZ` | `customer.naturalPerson` |
| Cashier/register refs | `Rg:0024 Tr:0063` | `pos.registerCode`, `pos.transactionCode` |
| Product | `MARI/PAM/CHOC/100G` | `items[].description` |
| Quantity and price | `2 x 300,33` | `items[].quantity`, `items[].unitPrice.amount` |
| Line total | `600,66` | `items[].lineTotal.amount` |
| Tax code marker | `G` | `items[].taxCategory.code` |
| Taxable base | `600,66` | `taxSummary[].taxableAmount.amount` |
| VAT rate | `16.00%` | `taxSummary[].rate` |
| VAT amount | `96,11` | `taxSummary[].taxAmount.amount` |
| Total payable | `696,77` | `totals.grandTotal.amount` |
| Payment methods | cash and debit | `payments[]` |
| FX note | `Compra en Divisas: $1,21`, `Tasa BCV: 577.55 Bs.` | `foreignExchange` |
| Footer terms | return and payment-condition text | `footer.messages[]` |
| Barcode value | numeric string below barcode | `fiscalControl.barcode.value` |
| Fiscal printer register | `T1B2000492` | `fiscalControl.fiscalPrinterRegisterNumber` |

## API Resource Model

The API should treat an invoice as an immutable fiscal document after emission.
Recommended resources:

- `POST /invoices`: validates a draft and emits the invoice through the selected
  fiscal channel.
- `GET /invoices/{id}`: returns the stored canonical invoice.
- `GET /invoices/{id}/render?format=thermal-80mm|pdf|json`: returns a printable
  representation.
- `POST /invoices/{id}/void` or `POST /credit-notes`: use only when supported by
  the applicable fiscal workflow; do not mutate the original invoice.

Recommended lifecycle statuses:

- `draft`: local validation only, not fiscal.
- `pending_emission`: accepted by the API but waiting on printer/provider.
- `issued`: fiscal number, timestamp, and control fields assigned.
- `failed`: emission was not completed; no fiscal document was issued.
- `cancelled_by_credit_note`: economic reversal was made through a related
  fiscal document.

## Canonical Data Model

### Top-Level Invoice

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `schemaVersion` | string | yes | Version of this API contract, e.g. `ve-fiscal-invoice-1.0`. |
| `id` | string | no | Internal UUID or ULID. |
| `environment` | enum | yes | `test` or `production`. |
| `document` | object | yes | Type, fiscal number, date, and currency. |
| `issuer` | object | yes | Seller taxpayer data. |
| `customer` | object | yes | Buyer data. Use generic final-consumer fields only if allowed. |
| `pos` | object | conditional | Required for POS/fiscal-machine receipts. |
| `items` | array | yes | At least one line item. |
| `taxSummary` | array | yes | VAT and exempt/non-taxable summaries. |
| `totals` | object | yes | Subtotal, tax, discounts, and grand total. |
| `payments` | array | yes | Payment method breakdown. |
| `foreignExchange` | object | no | Required when displaying foreign-currency equivalent or accepting FX. |
| `fiscalControl` | object | conditional | Required once issued. Some fields are printer/provider-generated. |
| `footer` | object | no | Legal, commercial, and branch messages. |
| `metadata` | object | no | Correlation IDs, source order, operator notes. |

### Document

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `type` | enum | yes | `invoice`, `credit_note`, `debit_note`, `delivery_note`, `withholding_receipt`. |
| `displayName` | string | yes | Usually `FACTURA` for this receipt type. |
| `number` | string | conditional | Fiscal consecutive number; assigned by printer/provider. |
| `controlNumber` | string | conditional | Needed for formats/forms/free forms where applicable. |
| `issuedAt` | string | conditional | ISO 8601 timestamp with timezone after emission. |
| `currency` | string | yes | ISO 4217. For bolivar invoices use `VES`. |
| `language` | string | no | `es-VE` recommended. |
| `emissionChannel` | enum | yes | `fiscal_machine`, `digital_authorized_provider`, `free_form`, `manual_format`. |

### Party: Issuer and Customer

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `personType` | enum | yes | `natural_person`, `company`, or `final_consumer`. |
| `identifier` | object | yes | Venezuelan identifier split into `prefix`, `number`, optional `checkDigit`, and printed `value`. |
| `naturalPerson` | object | conditional | Required when `personType` is `natural_person`; includes first/second names and first/second last names. |
| `company` | object | conditional | Required when `personType` is `company`; includes `razonSocial`, optional `commercialName`, and identifier value. |
| `address` | object | issuer yes, customer optional | Structured lines, city, state, country. |
| `contacts` | array | no | Phones, email, or web. |

Identifier prefixes should be stored independently from the numeric value. Common
Venezuelan prefixes include `V`, `E`, `J`, `G`, `P`, and `C`, depending on the
taxpayer or identity type. The `value` field stores the normalized display value
used for printing and reconciliation, for example `J-09512461-4` or
`V-28476588`.

### Line Items

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `lineNumber` | integer | yes | Stable 1-based order. |
| `sku` | string | no | Internal SKU or barcode. |
| `description` | string | yes | Printed description. |
| `quantity` | number | yes | Decimal-safe numeric value. |
| `unitOfMeasure` | string | no | `unit`, `kg`, `service`, etc. |
| `unitPrice` | money | yes | Price before line discount, usually tax-exclusive for VAT math. |
| `discounts` | array | no | Line-level discounts or promotions. |
| `taxCategory` | object | yes | VAT category code and rate. |
| `lineSubtotal` | money | yes | Quantity x unit price minus discounts, before tax. |
| `lineTax` | money | yes | VAT amount for the line. |
| `lineTotal` | money | yes | Subtotal plus tax if tax-inclusive line totals are required. |
| `printMarkers` | object | no | Fiscal-machine markers such as `G` for taxable general rate. |

### Taxes

The schema supports the typical Venezuelan VAT categories:

- `general`: taxable at the general IVA rate, e.g. `16.00`.
- `reduced`: taxable at a reduced rate if applicable.
- `additional`: luxury/additional rate if applicable.
- `exempt`: exempt.
- `non_taxable`: outside VAT.

Amounts should be rounded using the issuer's fiscal-printer/provider rules.
Store both line-level and summary-level tax amounts to support audit trails.

### Payments

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `method` | enum | yes | `cash`, `debit_card`, `credit_card`, `mobile_payment`, `bank_transfer`, `foreign_currency_cash`, `other`. |
| `amount` | money | yes | Amount applied in the invoice currency unless `currency` differs. |
| `currency` | string | yes | ISO 4217. |
| `reference` | string | no | Card/bank/mobile reference. Mask sensitive data. |
| `receivedAmount` | money | no | Cash tendered amount. |
| `changeAmount` | money | no | Cash change amount. |

### Fiscal Control

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `authorityName` | string | yes | `SENIAT`. |
| `fiscalPrinterRegisterNumber` | string | fiscal machine yes | Number printed after the fiscal logo/marker. |
| `machineSerialNumber` | string | conditional | Device serial, if separate from register. |
| `zReportNumber` | string | no | If available from fiscal machine. |
| `dailyClosureNumber` | string | no | If available. |
| `internalTransactionNumber` | string | no | POS or printer transaction. |
| `barcode` | object | no | Value and symbology used for printed receipt. |
| `providerAuthorization` | object | digital conditional | Required for authorized digital emission. |
| `signature` | object | conditional | Digital hash/signature if provider workflow emits one. |

## JSON Schema

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://salesfactory.local/schemas/ve-fiscal-invoice.schema.json",
  "title": "Venezuela Fiscal Invoice",
  "type": "object",
  "additionalProperties": false,
  "required": [
    "schemaVersion",
    "environment",
    "document",
    "issuer",
    "customer",
    "items",
    "taxSummary",
    "totals",
    "payments"
  ],
  "properties": {
    "schemaVersion": {
      "type": "string",
      "const": "ve-fiscal-invoice-1.0"
    },
    "id": {
      "type": "string",
      "minLength": 1
    },
    "environment": {
      "type": "string",
      "enum": ["test", "production"]
    },
    "status": {
      "type": "string",
      "enum": ["draft", "pending_emission", "issued", "failed", "cancelled_by_credit_note"]
    },
    "document": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "displayName", "currency", "emissionChannel"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["invoice", "credit_note", "debit_note", "delivery_note", "withholding_receipt"]
        },
        "displayName": {
          "type": "string",
          "minLength": 1
        },
        "number": {
          "type": "string",
          "pattern": "^[0-9A-Za-z-]{1,32}$"
        },
        "controlNumber": {
          "type": "string",
          "minLength": 1,
          "maxLength": 32
        },
        "issuedAt": {
          "type": "string",
          "format": "date-time"
        },
        "currency": {
          "$ref": "#/$defs/currencyCode"
        },
        "language": {
          "type": "string",
          "default": "es-VE"
        },
        "emissionChannel": {
          "type": "string",
          "enum": ["fiscal_machine", "digital_authorized_provider", "free_form", "manual_format"]
        }
      }
    },
    "issuer": {
      "$ref": "#/$defs/issuer"
    },
    "customer": {
      "$ref": "#/$defs/customer"
    },
    "pos": {
      "$ref": "#/$defs/pos"
    },
    "items": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/invoiceItem"
      }
    },
    "taxSummary": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/taxSummary"
      }
    },
    "totals": {
      "$ref": "#/$defs/totals"
    },
    "payments": {
      "type": "array",
      "minItems": 1,
      "items": {
        "$ref": "#/$defs/payment"
      }
    },
    "foreignExchange": {
      "$ref": "#/$defs/foreignExchange"
    },
    "fiscalControl": {
      "$ref": "#/$defs/fiscalControl"
    },
    "footer": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "paymentCondition": {
          "type": "string"
        },
        "messages": {
          "type": "array",
          "items": {
            "type": "string",
            "minLength": 1
          }
        }
      }
    },
    "metadata": {
      "type": "object",
      "additionalProperties": true
    }
  },
  "$defs": {
    "currencyCode": {
      "type": "string",
      "pattern": "^[A-Z]{3}$"
    },
    "money": {
      "type": "object",
      "additionalProperties": false,
      "required": ["amount", "currency"],
      "properties": {
        "amount": {
          "type": "string",
          "pattern": "^-?[0-9]+(\\.[0-9]{1,6})?$"
        },
        "currency": {
          "$ref": "#/$defs/currencyCode"
        }
      }
    },
    "address": {
      "type": "object",
      "additionalProperties": false,
      "required": ["lines", "country"],
      "properties": {
        "lines": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "string",
            "minLength": 1
          }
        },
        "city": {
          "type": "string"
        },
        "state": {
          "type": "string"
        },
        "postalCode": {
          "type": "string"
        },
        "country": {
          "type": "string",
          "const": "VE"
        }
      }
    },
    "contact": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "value"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["phone", "email", "website"]
        },
        "value": {
          "type": "string",
          "minLength": 1
        }
      }
    },
    "identifier": {
      "type": "object",
      "additionalProperties": false,
      "required": ["prefix", "number", "value"],
      "properties": {
        "prefix": {
          "type": "string",
          "enum": ["V", "E", "J", "G", "P", "C"]
        },
        "number": {
          "type": "string",
          "pattern": "^[0-9]{5,10}$"
        },
        "checkDigit": {
          "type": "string",
          "pattern": "^[0-9]$"
        },
        "value": {
          "type": "string",
          "pattern": "^[VEJGPC][- ]?[0-9]{5,10}([- ]?[0-9])?$"
        }
      }
    },
    "naturalPerson": {
      "type": "object",
      "additionalProperties": false,
      "required": ["firstName", "firstLastName"],
      "properties": {
        "firstName": {
          "type": "string",
          "minLength": 1
        },
        "secondName": {
          "type": "string"
        },
        "firstLastName": {
          "type": "string",
          "minLength": 1
        },
        "secondLastName": {
          "type": "string"
        },
        "displayName": {
          "type": "string",
          "description": "Printed customer name when the receipt needs one line."
        }
      }
    },
    "company": {
      "type": "object",
      "additionalProperties": false,
      "required": ["razonSocial"],
      "properties": {
        "razonSocial": {
          "type": "string",
          "minLength": 1
        },
        "commercialName": {
          "type": "string"
        },
        "displayName": {
          "type": "string",
          "description": "Printed company name when it differs from razonSocial or commercialName."
        }
      }
    },
    "issuer": {
      "type": "object",
      "additionalProperties": false,
      "required": ["personType", "identifier", "address"],
      "properties": {
        "personType": {
          "type": "string",
          "enum": ["natural_person", "company"]
        },
        "identifier": {
          "$ref": "#/$defs/identifier"
        },
        "naturalPerson": {
          "$ref": "#/$defs/naturalPerson"
        },
        "company": {
          "$ref": "#/$defs/company"
        },
        "address": {
          "$ref": "#/$defs/address"
        },
        "contacts": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/contact"
          }
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "personType": {
                "const": "natural_person"
              }
            }
          },
          "then": {
            "required": ["naturalPerson"]
          }
        },
        {
          "if": {
            "properties": {
              "personType": {
                "const": "company"
              }
            }
          },
          "then": {
            "required": ["company"]
          }
        }
      ]
    },
    "customer": {
      "type": "object",
      "additionalProperties": false,
      "required": ["personType"],
      "properties": {
        "personType": {
          "type": "string",
          "enum": ["natural_person", "company", "final_consumer"]
        },
        "identifier": {
          "$ref": "#/$defs/identifier"
        },
        "naturalPerson": {
          "$ref": "#/$defs/naturalPerson"
        },
        "company": {
          "$ref": "#/$defs/company"
        },
        "address": {
          "$ref": "#/$defs/address"
        },
        "contacts": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/contact"
          }
        },
        "isFinalConsumer": {
          "type": "boolean",
          "default": false
        }
      },
      "allOf": [
        {
          "if": {
            "properties": {
              "personType": {
                "const": "natural_person"
              }
            }
          },
          "then": {
            "required": ["identifier", "naturalPerson"]
          }
        },
        {
          "if": {
            "properties": {
              "personType": {
                "const": "company"
              }
            }
          },
          "then": {
            "required": ["identifier", "company"]
          }
        }
      ]
    },
    "pos": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "branchCode": {
          "type": "string"
        },
        "terminalCode": {
          "type": "string"
        },
        "registerCode": {
          "type": "string"
        },
        "transactionCode": {
          "type": "string"
        },
        "cashierId": {
          "type": "string"
        },
        "cashierName": {
          "type": "string"
        }
      }
    },
    "discount": {
      "type": "object",
      "additionalProperties": false,
      "required": ["type", "amount"],
      "properties": {
        "type": {
          "type": "string",
          "enum": ["percentage", "fixed_amount", "promotion"]
        },
        "description": {
          "type": "string"
        },
        "rate": {
          "type": "string",
          "pattern": "^[0-9]+(\\.[0-9]{1,4})?$"
        },
        "amount": {
          "$ref": "#/$defs/money"
        }
      }
    },
    "taxCategory": {
      "type": "object",
      "additionalProperties": false,
      "required": ["code", "type", "rate"],
      "properties": {
        "code": {
          "type": "string",
          "description": "Printer/API tax marker such as G, R, A, E, or N."
        },
        "type": {
          "type": "string",
          "enum": ["general", "reduced", "additional", "exempt", "non_taxable"]
        },
        "rate": {
          "type": "string",
          "pattern": "^[0-9]+(\\.[0-9]{1,4})?$"
        }
      }
    },
    "invoiceItem": {
      "type": "object",
      "additionalProperties": false,
      "required": [
        "lineNumber",
        "description",
        "quantity",
        "unitPrice",
        "taxCategory",
        "lineSubtotal",
        "lineTax",
        "lineTotal"
      ],
      "properties": {
        "lineNumber": {
          "type": "integer",
          "minimum": 1
        },
        "sku": {
          "type": "string"
        },
        "description": {
          "type": "string",
          "minLength": 1
        },
        "quantity": {
          "type": "string",
          "pattern": "^[0-9]+(\\.[0-9]{1,6})?$"
        },
        "unitOfMeasure": {
          "type": "string"
        },
        "unitPrice": {
          "$ref": "#/$defs/money"
        },
        "discounts": {
          "type": "array",
          "items": {
            "$ref": "#/$defs/discount"
          }
        },
        "taxCategory": {
          "$ref": "#/$defs/taxCategory"
        },
        "lineSubtotal": {
          "$ref": "#/$defs/money"
        },
        "lineTax": {
          "$ref": "#/$defs/money"
        },
        "lineTotal": {
          "$ref": "#/$defs/money"
        },
        "printMarkers": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "taxLetter": {
              "type": "string"
            }
          }
        }
      }
    },
    "taxSummary": {
      "type": "object",
      "additionalProperties": false,
      "required": ["taxCategory", "taxableAmount", "taxAmount"],
      "properties": {
        "taxCategory": {
          "$ref": "#/$defs/taxCategory"
        },
        "taxableAmount": {
          "$ref": "#/$defs/money"
        },
        "taxAmount": {
          "$ref": "#/$defs/money"
        }
      }
    },
    "totals": {
      "type": "object",
      "additionalProperties": false,
      "required": ["subtotal", "discountTotal", "taxTotal", "grandTotal", "amountPayable"],
      "properties": {
        "subtotal": {
          "$ref": "#/$defs/money"
        },
        "discountTotal": {
          "$ref": "#/$defs/money"
        },
        "taxTotal": {
          "$ref": "#/$defs/money"
        },
        "grandTotal": {
          "$ref": "#/$defs/money"
        },
        "amountPayable": {
          "$ref": "#/$defs/money"
        },
        "itemCount": {
          "type": "integer",
          "minimum": 1
        }
      }
    },
    "payment": {
      "type": "object",
      "additionalProperties": false,
      "required": ["method", "amount", "currency"],
      "properties": {
        "method": {
          "type": "string",
          "enum": [
            "cash",
            "debit_card",
            "credit_card",
            "mobile_payment",
            "bank_transfer",
            "foreign_currency_cash",
            "other"
          ]
        },
        "amount": {
          "$ref": "#/$defs/money"
        },
        "currency": {
          "$ref": "#/$defs/currencyCode"
        },
        "reference": {
          "type": "string"
        },
        "receivedAmount": {
          "$ref": "#/$defs/money"
        },
        "changeAmount": {
          "$ref": "#/$defs/money"
        }
      }
    },
    "foreignExchange": {
      "type": "object",
      "additionalProperties": false,
      "required": ["baseCurrency", "quoteCurrency", "rate", "source"],
      "properties": {
        "baseCurrency": {
          "$ref": "#/$defs/currencyCode"
        },
        "quoteCurrency": {
          "$ref": "#/$defs/currencyCode"
        },
        "rate": {
          "type": "string",
          "pattern": "^[0-9]+(\\.[0-9]{1,8})?$"
        },
        "source": {
          "type": "string",
          "enum": ["BCV", "issuer", "provider", "other"]
        },
        "displayEquivalent": {
          "$ref": "#/$defs/money"
        },
        "rateEffectiveDate": {
          "type": "string",
          "format": "date"
        }
      }
    },
    "fiscalControl": {
      "type": "object",
      "additionalProperties": false,
      "required": ["authorityName"],
      "properties": {
        "authorityName": {
          "type": "string",
          "const": "SENIAT"
        },
        "fiscalPrinterRegisterNumber": {
          "type": "string"
        },
        "machineSerialNumber": {
          "type": "string"
        },
        "zReportNumber": {
          "type": "string"
        },
        "dailyClosureNumber": {
          "type": "string"
        },
        "internalTransactionNumber": {
          "type": "string"
        },
        "barcode": {
          "type": "object",
          "additionalProperties": false,
          "required": ["symbology", "value"],
          "properties": {
            "symbology": {
              "type": "string",
              "enum": ["code128", "ean13", "qr", "pdf417", "other"]
            },
            "value": {
              "type": "string",
              "minLength": 1
            }
          }
        },
        "providerAuthorization": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "providerTaxId": {
              "type": "string"
            },
            "authorizationNumber": {
              "type": "string"
            },
            "authorizationDate": {
              "type": "string",
              "format": "date"
            }
          }
        },
        "signature": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "algorithm": {
              "type": "string"
            },
            "hash": {
              "type": "string"
            }
          }
        }
      }
    }
  },
  "allOf": [
    {
      "if": {
        "properties": {
          "document": {
            "properties": {
              "emissionChannel": {
                "const": "fiscal_machine"
              }
            }
          }
        }
      },
      "then": {
        "required": ["pos", "fiscalControl"],
        "properties": {
          "fiscalControl": {
            "required": ["authorityName", "fiscalPrinterRegisterNumber"]
          }
        }
      }
    },
    {
      "if": {
        "properties": {
          "status": {
            "const": "issued"
          }
        }
      },
      "then": {
        "properties": {
          "document": {
            "required": ["number", "issuedAt"]
          }
        },
        "required": ["fiscalControl"]
      }
    }
  ]
}
```

## Example 1: Receipt Matching the Photo

```json
{
  "schemaVersion": "ve-fiscal-invoice-1.0",
  "id": "inv_01jz_photo_example",
  "environment": "production",
  "status": "issued",
  "document": {
    "type": "invoice",
    "displayName": "FACTURA",
    "number": "000046998",
    "issuedAt": "2026-06-11T17:42:00-04:00",
    "currency": "VES",
    "language": "es-VE",
    "emissionChannel": "fiscal_machine"
  },
  "issuer": {
    "personType": "company",
    "identifier": {
      "prefix": "J",
      "number": "09512461",
      "checkDigit": "4",
      "value": "J-09512461-4"
    },
    "company": {
      "razonSocial": "CENTRAL SANTO TOME III, C.A",
      "commercialName": "Central Santo Tome"
    },
    "address": {
      "lines": [
        "Av Atlantico con Av Espana C C Santo Tome",
        "Los Olivos Nivel PB Local Santo Tome",
        "Sector Los Olivos Pto Ordaz"
      ],
      "city": "Puerto Ordaz",
      "state": "Bolivar",
      "country": "VE"
    },
    "contacts": [
      {
        "type": "phone",
        "value": "0286-9619023"
      },
      {
        "type": "phone",
        "value": "9624663"
      }
    ]
  },
  "customer": {
    "personType": "natural_person",
    "identifier": {
      "prefix": "V",
      "number": "28476588",
      "value": "V-28476588"
    },
    "naturalPerson": {
      "firstName": "ALFONZO",
      "firstLastName": "SUAREZ",
      "displayName": "ALFONZO SUAREZ"
    }
  },
  "pos": {
    "registerCode": "0024",
    "transactionCode": "0063",
    "cashierName": "NORKYS MEDINA"
  },
  "items": [
    {
      "lineNumber": 1,
      "description": "MARI/PAM/CHOC/100G",
      "quantity": "2",
      "unitOfMeasure": "unit",
      "unitPrice": {
        "amount": "300.33",
        "currency": "VES"
      },
      "taxCategory": {
        "code": "G",
        "type": "general",
        "rate": "16.00"
      },
      "lineSubtotal": {
        "amount": "600.66",
        "currency": "VES"
      },
      "lineTax": {
        "amount": "96.11",
        "currency": "VES"
      },
      "lineTotal": {
        "amount": "696.77",
        "currency": "VES"
      },
      "printMarkers": {
        "taxLetter": "G"
      }
    }
  ],
  "taxSummary": [
    {
      "taxCategory": {
        "code": "G",
        "type": "general",
        "rate": "16.00"
      },
      "taxableAmount": {
        "amount": "600.66",
        "currency": "VES"
      },
      "taxAmount": {
        "amount": "96.11",
        "currency": "VES"
      }
    }
  ],
  "totals": {
    "subtotal": {
      "amount": "600.66",
      "currency": "VES"
    },
    "discountTotal": {
      "amount": "0.00",
      "currency": "VES"
    },
    "taxTotal": {
      "amount": "96.11",
      "currency": "VES"
    },
    "grandTotal": {
      "amount": "696.77",
      "currency": "VES"
    },
    "amountPayable": {
      "amount": "696.77",
      "currency": "VES"
    },
    "itemCount": 2
  },
  "payments": [
    {
      "method": "cash",
      "amount": {
        "amount": "600.00",
        "currency": "VES"
      },
      "currency": "VES"
    },
    {
      "method": "debit_card",
      "amount": {
        "amount": "96.77",
        "currency": "VES"
      },
      "currency": "VES"
    }
  ],
  "foreignExchange": {
    "baseCurrency": "USD",
    "quoteCurrency": "VES",
    "rate": "577.55",
    "source": "BCV",
    "displayEquivalent": {
      "amount": "1.21",
      "currency": "USD"
    },
    "rateEffectiveDate": "2026-06-11"
  },
  "fiscalControl": {
    "authorityName": "SENIAT",
    "fiscalPrinterRegisterNumber": "T1B2000492",
    "internalTransactionNumber": "003",
    "barcode": {
      "symbology": "code128",
      "value": "0003024006372606111740000200069677058"
    }
  },
  "footer": {
    "paymentCondition": "CONTADO",
    "messages": [
      "GRACIAS POR PREFERIRNOS",
      "MAXIMO 1 DIA PARA DEVOLUCIONES TICKET REQUERIDO",
      "PARA LA DEVOLUCION Y SOLO SE REALIZARA EN LA SUCURSAL DONDE SE EMITIO EL TICKET"
    ]
  }
}
```

## Example 2: Identified Customer With Card Payment

```json
{
  "schemaVersion": "ve-fiscal-invoice-1.0",
  "environment": "production",
  "status": "issued",
  "document": {
    "type": "invoice",
    "displayName": "FACTURA",
    "number": "000102345",
    "issuedAt": "2026-06-12T10:15:33-04:00",
    "currency": "VES",
    "language": "es-VE",
    "emissionChannel": "fiscal_machine"
  },
  "issuer": {
    "personType": "company",
    "identifier": {
      "prefix": "J",
      "number": "12345678",
      "checkDigit": "9",
      "value": "J-12345678-9"
    },
    "company": {
      "razonSocial": "COMERCIAL EJEMPLO, C.A.",
      "commercialName": "Comercial Ejemplo"
    },
    "address": {
      "lines": ["Av. Principal, Local 12"],
      "city": "Caracas",
      "state": "Distrito Capital",
      "country": "VE"
    }
  },
  "customer": {
    "personType": "natural_person",
    "identifier": {
      "prefix": "V",
      "number": "12345678",
      "value": "V-12345678"
    },
    "naturalPerson": {
      "firstName": "MARIA",
      "firstLastName": "PEREZ",
      "displayName": "MARIA PEREZ"
    },
    "address": {
      "lines": ["Urb. Los Palos Grandes"],
      "city": "Caracas",
      "state": "Distrito Capital",
      "country": "VE"
    }
  },
  "pos": {
    "branchCode": "CCS-01",
    "terminalCode": "POS-03",
    "registerCode": "0003",
    "transactionCode": "4129",
    "cashierId": "usr_45"
  },
  "items": [
    {
      "lineNumber": 1,
      "sku": "7501000000012",
      "description": "CAFE MOLIDO 500G",
      "quantity": "1",
      "unitOfMeasure": "unit",
      "unitPrice": {
        "amount": "210.00",
        "currency": "VES"
      },
      "taxCategory": {
        "code": "G",
        "type": "general",
        "rate": "16.00"
      },
      "lineSubtotal": {
        "amount": "210.00",
        "currency": "VES"
      },
      "lineTax": {
        "amount": "33.60",
        "currency": "VES"
      },
      "lineTotal": {
        "amount": "243.60",
        "currency": "VES"
      }
    }
  ],
  "taxSummary": [
    {
      "taxCategory": {
        "code": "G",
        "type": "general",
        "rate": "16.00"
      },
      "taxableAmount": {
        "amount": "210.00",
        "currency": "VES"
      },
      "taxAmount": {
        "amount": "33.60",
        "currency": "VES"
      }
    }
  ],
  "totals": {
    "subtotal": {
      "amount": "210.00",
      "currency": "VES"
    },
    "discountTotal": {
      "amount": "0.00",
      "currency": "VES"
    },
    "taxTotal": {
      "amount": "33.60",
      "currency": "VES"
    },
    "grandTotal": {
      "amount": "243.60",
      "currency": "VES"
    },
    "amountPayable": {
      "amount": "243.60",
      "currency": "VES"
    },
    "itemCount": 1
  },
  "payments": [
    {
      "method": "debit_card",
      "amount": {
        "amount": "243.60",
        "currency": "VES"
      },
      "currency": "VES",
      "reference": "****8291"
    }
  ],
  "fiscalControl": {
    "authorityName": "SENIAT",
    "fiscalPrinterRegisterNumber": "Z1A0001234",
    "internalTransactionNumber": "4129"
  }
}
```

## Example 3: Mixed Taxable and Exempt Items With Discount

```json
{
  "schemaVersion": "ve-fiscal-invoice-1.0",
  "environment": "test",
  "status": "draft",
  "document": {
    "type": "invoice",
    "displayName": "FACTURA",
    "currency": "VES",
    "language": "es-VE",
    "emissionChannel": "digital_authorized_provider"
  },
  "issuer": {
    "personType": "company",
    "identifier": {
      "prefix": "J",
      "number": "87654321",
      "checkDigit": "0",
      "value": "J-87654321-0"
    },
    "company": {
      "razonSocial": "SERVICIOS DIGITALES EJEMPLO, C.A.",
      "commercialName": "Servicios Digitales Ejemplo"
    },
    "address": {
      "lines": ["Av. Universidad, Torre Norte, Piso 4"],
      "city": "Valencia",
      "state": "Carabobo",
      "country": "VE"
    }
  },
  "customer": {
    "personType": "company",
    "identifier": {
      "prefix": "J",
      "number": "11111111",
      "checkDigit": "1",
      "value": "J-11111111-1"
    },
    "company": {
      "razonSocial": "CLIENTE EMPRESARIAL, C.A.",
      "commercialName": "Cliente Empresarial"
    }
  },
  "items": [
    {
      "lineNumber": 1,
      "description": "SERVICIO DE SOPORTE MENSUAL",
      "quantity": "1",
      "unitOfMeasure": "service",
      "unitPrice": {
        "amount": "1000.00",
        "currency": "VES"
      },
      "discounts": [
        {
          "type": "percentage",
          "description": "Descuento comercial",
          "rate": "10.00",
          "amount": {
            "amount": "100.00",
            "currency": "VES"
          }
        }
      ],
      "taxCategory": {
        "code": "G",
        "type": "general",
        "rate": "16.00"
      },
      "lineSubtotal": {
        "amount": "900.00",
        "currency": "VES"
      },
      "lineTax": {
        "amount": "144.00",
        "currency": "VES"
      },
      "lineTotal": {
        "amount": "1044.00",
        "currency": "VES"
      }
    },
    {
      "lineNumber": 2,
      "description": "PRODUCTO EXENTO",
      "quantity": "2",
      "unitOfMeasure": "unit",
      "unitPrice": {
        "amount": "50.00",
        "currency": "VES"
      },
      "taxCategory": {
        "code": "E",
        "type": "exempt",
        "rate": "0.00"
      },
      "lineSubtotal": {
        "amount": "100.00",
        "currency": "VES"
      },
      "lineTax": {
        "amount": "0.00",
        "currency": "VES"
      },
      "lineTotal": {
        "amount": "100.00",
        "currency": "VES"
      }
    }
  ],
  "taxSummary": [
    {
      "taxCategory": {
        "code": "G",
        "type": "general",
        "rate": "16.00"
      },
      "taxableAmount": {
        "amount": "900.00",
        "currency": "VES"
      },
      "taxAmount": {
        "amount": "144.00",
        "currency": "VES"
      }
    },
    {
      "taxCategory": {
        "code": "E",
        "type": "exempt",
        "rate": "0.00"
      },
      "taxableAmount": {
        "amount": "100.00",
        "currency": "VES"
      },
      "taxAmount": {
        "amount": "0.00",
        "currency": "VES"
      }
    }
  ],
  "totals": {
    "subtotal": {
      "amount": "1000.00",
      "currency": "VES"
    },
    "discountTotal": {
      "amount": "100.00",
      "currency": "VES"
    },
    "taxTotal": {
      "amount": "144.00",
      "currency": "VES"
    },
    "grandTotal": {
      "amount": "1144.00",
      "currency": "VES"
    },
    "amountPayable": {
      "amount": "1144.00",
      "currency": "VES"
    },
    "itemCount": 3
  },
  "payments": [
    {
      "method": "bank_transfer",
      "amount": {
        "amount": "1144.00",
        "currency": "VES"
      },
      "currency": "VES",
      "reference": "0102-20260612-000099"
    }
  ]
}
```

## Validation and Implementation Notes

- Store monetary values as decimal strings in API payloads to avoid binary
  floating-point errors.
- Use ISO 8601 timestamps with the Venezuela timezone offset used by the issuing
  system.
- Do not let clients choose final fiscal numbers, signatures, provider hashes,
  Z-report numbers, or fiscal printer register numbers unless the request comes
  from a trusted emission adapter.
- Recalculate all totals server-side and reject payloads where item sums, tax
  summary, payments, and grand total do not reconcile.
- Preserve the original issued JSON exactly, including fiscal-control fields, for
  audit and reprint.
- Keep rendering concerns separate from fiscal data. Thermal receipts may need
  truncation, fixed-width formatting, and printer-specific tax letters, but the
  canonical API payload should remain structured.
- For digital issuance, add provider-specific authorization, signature, QR, and
  retention/book fields required by the provider and SENIAT authorization.
