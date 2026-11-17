package com.showcase.tests;

import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Invoice;
import com.showcase.api.ApiClient.Paginated;
import com.showcase.data.Customers.Customer;

/** Shared assertion helpers for the journeys: the backend view of a customer's orders. */
final class Invoices {
  private Invoices() {}

  static Paginated<Invoice> of(ApiClient api, Customer customer) {
    return api.invoices(api.login(customer.email(), customer.password()));
  }

  /** The customer's invoice with this number; fails with a readable message if it does not exist. */
  static Invoice find(ApiClient api, Customer customer, String invoiceNumber) {
    return of(api, customer).data().stream()
        .filter(i -> i.invoiceNumber().equals(invoiceNumber))
        .findFirst()
        .orElseThrow(() -> new AssertionError("invoice " + invoiceNumber + " for " + customer.email() + " not found"));
  }
}
