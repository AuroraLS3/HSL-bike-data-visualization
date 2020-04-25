package com.djrapitops.filterer;

import java.io.*;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public class Main {

    public static void main(String[] args) throws Exception {
        Path dataDir = new File("").toPath().toAbsolutePath().getParent()
                .resolve("data");
        Path csvDir = dataDir.resolve("csv");
        Path read = csvDir.resolve("tellingit_2017-2019.csv");
        Path write = csvDir.resolve("tellingit_filtered_2017-2019.csv");

        Files.createDirectories(csvDir);
        try (Stream<String> lines = Files.lines(read)) {
            Set<Identifier> identifiers = new HashSet<>();
            Files.write(write, lines
                            .filter(line -> {
                                String[] split = line.split(";");
                                String id = split[0].trim();
                                String year = split[6].trim();
                                Identifier identifier = new Identifier(id, year);
                                boolean contains = identifiers.contains(identifier);
                                if (!contains) {
                                    identifiers.add(identifier);
                                    return true;
                                }
                                return false;
                            }).collect(Collectors.toList()),
                    StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING
            );
        }
    }

    static class Identifier {
        String id;
        String year;

        public Identifier(String id, String year) {
            this.id = id;
            this.year = year;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Identifier that = (Identifier) o;
            return Objects.equals(id, that.id) &&
                    Objects.equals(year, that.year);
        }

        @Override
        public int hashCode() {
            return Objects.hash(id, year);
        }
    }
}
