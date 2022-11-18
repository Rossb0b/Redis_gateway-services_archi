export type Events = Foo | Bar;

export interface Foo {
  name: "foo",
  data: {
    id: number
  }
}

export interface Bar {
  name: "bar",
  data: {
    id: number
  }
}
