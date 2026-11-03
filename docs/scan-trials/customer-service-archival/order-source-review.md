# Order changes

This is the independent source oracle for Q19, frozen before extraction changes. It describes source paths at
`volvo-cars/cds-ecom-customer-service`, commit `09623ab3a1f39845d8fc02abc3d591b53a3b5fea`.
It establishes local source behaviour, with runtime activation, Kafka delivery, acknowledgement, database
commit and external serialisation left unobserved.

- `OrderUpdateEventConsumer.java:24–31,40–68,117–134`: decode first. A customer update takes priority and
  returns after unarchiving. Other events mark only a non-null payload whose status belongs to the immutable
  declared list COMPLETED, CANCELLED, ABANDONED, event type is ORDERCHANGEEVENT, order type is BASIC and customer
  ID has text. Null payloads, blank IDs, other event types, other order types (including change orders) and
  other statuses do not reach marking. CustomerUpdate category is exact and case-sensitive; it requires a
  non-null payload and a customer ID with text, without requiring the order status/type filters.
- `OrderUpdateEventConsumer.java:117–125`: COMPLETED maps to ORDER_COMPLETED, CANCELLED to ORDER_CANCELLED,
  ABANDONED to ABANDONED. An unexpected status throws IllegalArgumentException. The mark attempt catches
  CustomerServiceException and logs; this is not evidence of broker retry or successful persistence.
- `OrderUpdateEventConsumer.java:77–99`: a customer update reads the live customer. If it has no archival
  data, return without saving. Otherwise clear archivalData with null and call saveCustomer(updatedCustomer).
  CustomerNotFoundException invokes the archive restore helper; CustomerServiceException logs a warning.
- `OrderUpdateEventConsumer.java:101–115`: restore helper calls the archive service with the event customer
  ID and false. CustomerServiceException logs an error; it does not escape this helper.
- `CustomerService.java:265–270,281–299`: saveCustomer validates then saves, returns the rebound saved value,
  and does not invoke postprocessing. markForArchival reads the customer, returns if already marked, otherwise
  creates archivalData(reason, Instant.now().plus(90, DAYS)), rebuilds the customer, then invokes
  saveAndPostProcess(originalCustomer, customer).
- `CustomerArchiveService.java:55–82`: the exact (String, boolean) overload reads the archive, throws
  CustomerNotFoundException if absent, clears version, and with false clears archivalData. It calls
  saveCustomer before deleting the archive, then returns the saved customer. The source declares no atomicity
  guarantee for those two repository operations; a synchronous save exception prevents the delete.

The independent checker must require typed branch/body/condition edges, ordered statement roles, parsed scalar
constants and collection member lineage, nominal overload targets and ordinal actual/formal value links.
Rendered syntax and same-spelled method names cannot substitute for those relations. Bounded ID-sorted pages
must preserve the same whole-question result. Removing any essential filter, branch, enum mapping, save,
restore argument or source/value relation must reject the baseline proof.
